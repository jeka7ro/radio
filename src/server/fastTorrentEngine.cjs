'use strict';

const hat = require('hat');
const pws = require('peer-wire-swarm');
const bncode = require('bncode');
const crypto = require('node:crypto');
const bitfield = require('bitfield');
const parseTorrent = require('parse-torrent');
const mkdirp = require('mkdirp');
const events = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const eos = require('end-of-stream');
const piece = require('torrent-piece');
const rimraf = require('rimraf');
const stream = require('node:stream');
const util = require('node:util');
const FSChunkStore = require('fs-chunk-store');
const ImmediateChunkStore = require('immediate-chunk-store');
const peerDiscovery = require('torrent-discovery');
const bufferFrom = require('buffer-from');
const blocklist = require('ip-set');

// Modern high-bandwidth streaming constants (replaces 2014 ADSL MAX_REQUESTS=5 & broken piece.BLOCK_SIZE)
const BLOCK_LEN = piece.BLOCK_LENGTH || 16384;
const MIN_REQUESTS = 8;
const MAX_REQUESTS_FAST = 64; // 64 * 16KB = 1MB in-flight pipeline per fast seedbox peer
const CHOKE_TIMEOUT = 4000;
const REQUEST_TIMEOUT = 10000;
const SPEED_THRESHOLD = 4 * BLOCK_LEN; // 64 KB/s baseline
const DEFAULT_PORT = 6881;
const BAD_PIECE_STRIKES_MAX = 3;
const BAD_PIECE_STRIKES_DURATION = 120000;
const RECHOKE_INTERVAL = 8000;
const RECHOKE_OPTIMISTIC_DURATION = 2;

const METADATA_BLOCK_SIZE = 1 << 14;
const METADATA_MAX_SIZE = 1 << 22;
const EXTENSIONS = { m: { ut_metadata: 1 } };

const TMP = fs.existsSync('/tmp')
  ? '/tmp'
  : os.tmpdir
    ? os.tmpdir()
    : '/tmp';

const noop = function () {};
const truthy = function () {
  return true;
};
const falsy = function () {
  return false;
};
const toNumber = function (val) {
  return val === true ? 1 : val || 0;
};
const sha1 = function (data) {
  return crypto.createHash('sha1').update(data).digest('hex');
};

function createExchangeMetadata(engine, callback) {
  let metadataPieces = [];

  return function (wire) {
    const metadata = engine.metadata;
    wire.once('extended', function (id, handshake) {
      try {
        handshake = bncode.decode(handshake);
      } catch {
        return;
      }
      if (id || !handshake.m || handshake.m.ut_metadata === undefined) return;

      const channel = handshake.m.ut_metadata;
      const size = handshake.metadata_size;

      wire.on('extended', function (extId, ext) {
        if (extId !== EXTENSIONS.m.ut_metadata) return;
        let curMeta = engine.metadata;
        let delimiter;
        let message;
        let pieceIdx;
        try {
          delimiter = ext.toString('ascii').indexOf('ee');
          message = bncode.decode(
            ext.slice(0, delimiter === -1 ? ext.length : delimiter + 2)
          );
          pieceIdx = message.piece;
        } catch {
          return;
        }
        if (pieceIdx < 0 || message.msg_type === 2) return;

        if (message.msg_type === 0) {
          if (!curMeta) {
            wire.extended(channel, { msg_type: 2, piece: pieceIdx });
            return;
          }
          const offset = pieceIdx * METADATA_BLOCK_SIZE;
          const buf = curMeta.slice(offset, offset + METADATA_BLOCK_SIZE);
          wire.extended(
            channel,
            Buffer.concat([
              bncode.encode({ msg_type: 1, piece: pieceIdx }),
              buf,
            ])
          );
          return;
        }

        if (message.msg_type === 1 && !curMeta) {
          metadataPieces[pieceIdx] = ext.slice(delimiter + 2);
          for (let i = 0; i * METADATA_BLOCK_SIZE < size; i++) {
            if (!metadataPieces[i]) return;
          }
          curMeta = Buffer.concat(metadataPieces);
          if (engine.infoHash !== sha1(curMeta)) {
            metadataPieces = [];
            curMeta = null;
            return;
          }
          engine.metadata = curMeta;
          callback(curMeta);
        }
      });

      if (size > METADATA_MAX_SIZE || !size || metadata) return;
      for (let i = 0; i * METADATA_BLOCK_SIZE < size; i++) {
        if (metadataPieces[i]) continue;
        wire.extended(channel, { msg_type: 0, piece: i });
      }
    });

    if (!wire.peerExtensions.extended) return;
    wire.extended(
      0,
      metadata
        ? { m: { ut_metadata: 1 }, metadata_size: metadata.length }
        : { m: { ut_metadata: 1 } }
    );
  };
}

function FastFileStream(engine, file, opts) {
  if (!(this instanceof FastFileStream)) {
    return new FastFileStream(engine, file, opts);
  }
  stream.Readable.call(this, { highWaterMark: 4 * 1024 * 1024 });

  if (!opts) opts = {};
  if (!opts.start) opts.start = 0;
  if (!opts.end && typeof opts.end !== 'number') opts.end = file.length - 1;

  const offset = opts.start + file.offset;
  const pieceLength = engine.torrent.pieceLength;

  this.length = opts.end - opts.start + 1;
  this.startPiece = Math.floor(offset / pieceLength);
  this.endPiece = Math.floor((opts.end + file.offset) / pieceLength);
  this._destroyed = false;
  this._engine = engine;
  this._piece = this.startPiece;
  this._missing = this.length;
  this._reading = false;
  this._notifying = false;
  // Keep at least 32MB (or 4 pieces of 8MB = ~26s of 1080p video) marked critical ahead of playhead!
  this._critical = Math.max(
    4,
    Math.min(12, Math.ceil((32 * 1024 * 1024) / pieceLength))
  );
  this._offset = offset - this.startPiece * pieceLength;
}

util.inherits(FastFileStream, stream.Readable);

FastFileStream.prototype._read = function () {
  if (this._reading) return;
  this._reading = true;
  this.notify();
};

FastFileStream.prototype.notify = function () {
  if (!this._reading || !this._missing || this._destroyed) return;

  const self = this;
  const curPiece = this._piece;

  // Always keep lookahead window marked critical so next pieces download before playhead arrives
  const lookaheadEnd = Math.min(this.endPiece, curPiece + this._critical);
  if (lookaheadEnd >= curPiece) {
    this._engine.critical(curPiece, lookaheadEnd - curPiece + 1);
  }

  if (!this._engine.bitfield.get(curPiece)) {
    // On-demand instant SSD piece verification if file already exists on disk (0ms wait for cached pieces!)
    if (this._engine._tryVerifyDiskPiece) {
      this._engine._tryVerifyDiskPiece(curPiece, function (verifiedOk) {
        if (verifiedOk && !self._destroyed) {
          self.notify();
        }
      });
    }
    return;
  }

  if (this._notifying) return;
  this._notifying = true;
  this._engine.store.get(this._piece++, function (err, buffer) {
    self._notifying = false;
    if (self._destroyed || !self._reading) return;
    if (err) return self.destroy(err);

    if (self._offset) {
      buffer = buffer.slice(self._offset);
      self._offset = 0;
    }
    if (self._missing < buffer.length) {
      buffer = buffer.slice(0, self._missing);
    }
    self._missing -= buffer.length;

    if (!self._missing) {
      self.push(buffer);
      self.push(null);
      return;
    }

    self._reading = false;
    self.push(buffer);
    // Proactively pre-verify next piece on disk if present
    if (
      self._piece <= self.endPiece &&
      !self._engine.bitfield.get(self._piece) &&
      self._engine._tryVerifyDiskPiece
    ) {
      self._engine._tryVerifyDiskPiece(self._piece, noop);
    }
  });
};

FastFileStream.prototype.destroy = function (err) {
  if (this._destroyed) return;
  this._destroyed = true;
  if (err) this.emit('error', err);
  this.emit('close');
};

function maxRequestsForWire(wire) {
  const spd = wire.downloadSpeed();
  if (spd >= 4 * 1024 * 1024) return MAX_REQUESTS_FAST; // >= 4 MB/s -> 64 blocks (1 MB)
  if (spd >= 1536 * 1024) return 40; // >= 1.5 MB/s -> 40 blocks (640 KB)
  if (spd >= 512 * 1024) return 24; // >= 512 KB/s -> 24 blocks (384 KB)
  if (spd >= 128 * 1024) return 14;
  return MIN_REQUESTS;
}

function fastTorrentStream(link, opts, cb) {
  if (typeof opts === 'function') return fastTorrentStream(link, null, opts);

  link = parseTorrent(link);
  const metadata = link.infoBuffer || null;
  const infoHash = link.infoHash;

  if (!opts) opts = {};
  if (!opts.id) opts.id = '-TS0008-' + hat(48);
  if (!opts.tmp) opts.tmp = TMP;
  if (!opts.name) opts.name = 'torrent-stream';
  if (!opts.flood) opts.flood = 0;
  if (!opts.pulse) opts.pulse = Number.MAX_SAFE_INTEGER;

  let usingTmp = false;
  let destroyed = false;

  if (!opts.path) {
    usingTmp = true;
    opts.path = path.join(opts.tmp, opts.name, infoHash);
  }

  const engine = new events.EventEmitter();
  const swarm = pws(infoHash, opts.id, {
    size: opts.connections || opts.size || 80,
    speed: 10,
  });
  const torrentPath = path.join(opts.tmp, opts.name, infoHash + '.torrent');

  if (cb) engine.on('ready', cb.bind(null, engine));

  engine.ready = function (readyCb) {
    if (engine.torrent) readyCb();
    else engine.once('ready', readyCb);
  };

  const wires = swarm.wires;
  const critical = [];
  let refresh = noop;

  const rechokeSlots =
    opts.uploads === false || opts.uploads === 0 ? 0 : +opts.uploads || 4;
  let rechokeOptimistic = null;
  let rechokeOptimisticTime = 0;
  let rechokeIntervalId = null;

  engine.infoHash = infoHash;
  engine.metadata = metadata;
  engine.path = opts.path;
  engine.files = [];
  engine.selection = [];
  engine.torrent = null;
  engine.bitfield = null;
  engine.amInterested = false;
  engine.store = null;
  engine.swarm = swarm;
  engine._flood = opts.flood;
  engine._pulse = opts.pulse;

  const discovery = peerDiscovery({
    peerId: bufferFrom(opts.id),
    dht: opts.dht !== undefined ? opts.dht : true,
    tracker: opts.tracker !== undefined ? opts.tracker : true,
    port: DEFAULT_PORT,
    announce: opts.trackers,
  });
  const blocked = blocklist(opts.blocklist);

  discovery.on('peer', function (addr) {
    if (blocked.contains(addr.split(':')[0])) {
      engine.emit('blocked-peer', addr);
    } else {
      engine.emit('peer', addr);
      engine.connect(addr);
    }
  });

  const ontorrent = function (torrent) {
    const storage = opts.storage || FSChunkStore;
    const diskFiles = torrent.files.map(function (file) {
      return {
        path: path.join(opts.path, file.path),
        length: file.length,
        offset: file.offset,
      };
    });
    const hasExistingFilesOnDisk = diskFiles.some(function (df) {
      try {
        return fs.existsSync(df.path) && fs.statSync(df.path).size > 0;
      } catch {
        return false;
      }
    });

    engine.store = ImmediateChunkStore(
      storage(torrent.pieceLength, { files: diskFiles })
    );
    engine.torrent = torrent;
    engine.bitfield = bitfield(torrent.pieces.length);

    const pieceLength = torrent.pieceLength;
    const pieceRemainder = torrent.length % pieceLength || pieceLength;

    const pieces = torrent.pieces.map(function (_, i) {
      return piece(
        i === torrent.pieces.length - 1 ? pieceRemainder : pieceLength
      );
    });
    const reservations = torrent.pieces.map(function () {
      return [];
    });
    const diskCheckAttempted = new Uint8Array(torrent.pieces.length);
    const diskCheckInFlight = new Map();

    process.nextTick(function () {
      discovery.setTorrent(torrent);
    });

    engine.files = torrent.files.map(function (file) {
      file = Object.create(file);
      const offsetPiece = Math.floor(file.offset / torrent.pieceLength);
      const endPiece = Math.floor(
        (file.offset + file.length - 1) / torrent.pieceLength
      );

      file.deselect = function () {
        engine.deselect(offsetPiece, endPiece, false);
      };

      file.select = function () {
        engine.select(offsetPiece, endPiece, false);
      };

      file.createReadStream = function (streamOpts) {
        const fileStreamInst = FastFileStream(engine, file, streamOpts);
        const notify = fileStreamInst.notify.bind(fileStreamInst);
        engine.select(
          fileStreamInst.startPiece,
          fileStreamInst.endPiece,
          true,
          notify
        );
        eos(fileStreamInst, function () {
          engine.deselect(
            fileStreamInst.startPiece,
            fileStreamInst.endPiece,
            true,
            notify
          );
        });
        return fileStreamInst;
      };

      return file;
    });

    const oninterestchange = function () {
      const prev = engine.amInterested;
      engine.amInterested = !!engine.selection.length;

      wires.forEach(function (wire) {
        if (engine.amInterested) wire.interested();
        else wire.uninterested();
      });

      if (prev === engine.amInterested) return;
      if (engine.amInterested) engine.emit('interested');
      else engine.emit('uninterested');
    };

    const gc = function () {
      for (let i = 0; i < engine.selection.length; i++) {
        const s = engine.selection[i];
        const oldOffset = s.offset;

        while (!pieces[s.from + s.offset] && s.from + s.offset < s.to) {
          s.offset++;
        }

        if (oldOffset !== s.offset) s.notify();
        if (s.to !== s.from + s.offset) continue;
        if (pieces[s.from + s.offset]) continue;

        engine.selection.splice(i, 1);
        i--;
        s.notify();
        oninterestchange();
      }

      if (!engine.selection.length) engine.emit('idle');
    };

    // Instant on-demand piece verification from SSD (never blocks engine 'ready'!)
    engine._tryVerifyDiskPiece = function (index, doneCb) {
      if (destroyed || index < 0 || index >= torrent.pieces.length) {
        return doneCb(false);
      }
      if (!pieces[index] || engine.bitfield.get(index)) {
        return doneCb(true);
      }
      if (!hasExistingFilesOnDisk || diskCheckAttempted[index]) {
        return doneCb(false);
      }
      const waiting = diskCheckInFlight.get(index);
      if (waiting) {
        waiting.push(doneCb);
        return;
      }
      diskCheckInFlight.set(index, [doneCb]);
      engine.store.get(index, function (err, buf) {
        diskCheckAttempted[index] = 1;
        const cbs = diskCheckInFlight.get(index) || [];
        diskCheckInFlight.delete(index);

        if (
          !err &&
          buf &&
          pieces[index] &&
          sha1(buf) === torrent.pieces[index]
        ) {
          pieces[index] = null;
          reservations[index] = null;
          engine.bitfield.set(index, true);
          for (let w = 0; w < wires.length; w++) wires[w].have(index);
          engine.emit('verify', index);
          gc();
          for (let c = 0; c < cbs.length; c++) cbs[c](true);
        } else {
          for (let c = 0; c < cbs.length; c++) cbs[c](false);
        }
      });
    };

    const onpiececomplete = function (index, buffer) {
      if (!pieces[index]) return;

      pieces[index] = null;
      reservations[index] = null;
      diskCheckAttempted[index] = 1;
      engine.bitfield.set(index, true);

      for (let i = 0; i < wires.length; i++) wires[i].have(index);

      engine.emit('verify', index);
      engine.emit('download', index, buffer);

      engine.store.put(index, buffer);
      gc();
    };

    // FIXED onhotswap: uses BLOCK_LEN (16384) instead of undefined piece.BLOCK_SIZE!
    const onhotswap =
      opts.hotswap === false
        ? falsy
        : function (wire, index) {
            const speed = wire.downloadSpeed();
            if (speed < BLOCK_LEN * 2) return false;
            if (!reservations[index] || !pieces[index]) return false;

            const r = reservations[index];
            let minSpeed = Infinity;
            let min = null;

            for (let i = 0; i < r.length; i++) {
              const other = r[i];
              if (!other || other === wire) continue;

              const otherSpeed = other.downloadSpeed();
              // Allow fast seedboxes (>= 512 KB/s) to steal stalled/slow blocks from any peer running >= 2.5x slower!
              if (otherSpeed >= 512 * 1024 && speed < otherSpeed * 2.5) {
                continue;
              }
              if (1.8 * otherSpeed > speed || otherSpeed > minSpeed) continue;

              min = other;
              minSpeed = otherSpeed;
            }

            if (!min) return false;

            for (let i = 0; i < r.length; i++) {
              if (r[i] === min) r[i] = null;
            }

            for (let i = 0; i < min.requests.length; i++) {
              const req = min.requests[i];
              if (req.piece !== index) continue;
              pieces[index].cancel((req.offset / BLOCK_LEN) | 0);
            }

            engine.emit('hotswap', min, wire, index);
            return true;
          };

    const onupdatetick = function () {
      process.nextTick(onupdate);
    };

    const onrequest = function (wire, index, hotswap) {
      if (!pieces[index]) return false;

      const p = pieces[index];
      let reservation = p.reserve();

      if (reservation === -1 && hotswap && onhotswap(wire, index)) {
        reservation = p.reserve();
      }
      if (reservation === -1) return false;

      const r = reservations[index] || [];
      const offset = p.chunkOffset(reservation);
      const size = p.chunkLength(reservation);

      let i = r.indexOf(null);
      if (i === -1) i = r.length;
      r[i] = wire;

      wire.request(index, offset, size, function (err, block) {
        if (r[i] === wire) r[i] = null;

        if (p !== pieces[index]) return onupdatetick();

        if (err) {
          p.cancel(reservation);
          onupdatetick();
          return;
        }

        if (!p.set(reservation, block, wire)) return onupdatetick();

        const sources = p.sources;
        const buffer = p.flush();

        if (sha1(buffer) !== torrent.pieces[index]) {
          pieces[index] = piece(p.length);
          engine.emit('invalid-piece', index, buffer);
          onupdatetick();

          sources.forEach(function (srcWire) {
            const now = Date.now();
            srcWire.badPieceStrikes = srcWire.badPieceStrikes.filter(function (
              strike
            ) {
              return now - strike < BAD_PIECE_STRIKES_DURATION;
            });
            srcWire.badPieceStrikes.push(now);
            if (srcWire.badPieceStrikes.length > BAD_PIECE_STRIKES_MAX) {
              engine.block(srcWire.peerAddress);
            }
          });
          return;
        }

        onpiececomplete(index, buffer);
        onupdatetick();
      });

      return true;
    };

    const onvalidatewire = function (wire) {
      if (wire.requests.length >= 4) return;

      for (let i = 0; i < engine.selection.length; i++) {
        const next = engine.selection[i];
        for (let j = next.from + next.offset; j <= next.to; j++) {
          if (!wire.peerPieces[j]) continue;
          while (wire.requests.length < 4 && onrequest(wire, j, false)) {
            // pipeline initial validation blocks on the exact active piece
          }
          if (wire.requests.length) return;
        }
      }
    };

    const speedRanker = function (wire) {
      const speed = wire.downloadSpeed() || 1;
      if (speed > SPEED_THRESHOLD) return truthy;

      const maxReq = maxRequestsForWire(wire);
      const secs = (maxReq * BLOCK_LEN) / speed;
      let tries = 10;
      let ptr = 0;

      return function (index) {
        if (!tries || !pieces[index]) return true;

        let missing = pieces[index].missing;
        for (; ptr < wires.length; ptr++) {
          const other = wires[ptr];
          const otherSpeed = other.downloadSpeed();

          if (otherSpeed < SPEED_THRESHOLD) continue;
          if (otherSpeed <= speed || !other.peerPieces[index]) continue;
          if ((missing -= otherSpeed * secs) > 0) continue;

          tries--;
          return false;
        }

        return true;
      };
    };

    const select = function (wire, hotswap) {
      const maxReq = maxRequestsForWire(wire);
      if (wire.requests.length >= maxReq) return true;

      if (
        swarm.downloaded > engine._flood &&
        swarm.downloadSpeed() > engine._pulse
      ) {
        return true;
      }

      const rank = speedRanker(wire);

      // Strictly prioritize selections in order (active playhead first — NO shufflePriority splitting bandwidth!)
      for (let i = 0; i < engine.selection.length; i++) {
        const next = engine.selection[i];
        for (let j = next.from + next.offset; j <= next.to; j++) {
          if (!wire.peerPieces[j] || !rank(j)) continue;
          while (
            wire.requests.length < maxReq &&
            onrequest(wire, j, critical[j] || hotswap)
          ) {
            // fill pipeline
          }
          if (wire.requests.length >= maxReq) return true;
        }
      }

      return false;
    };

    var onupdatewire = function (wire) {
      if (wire.peerChoking) return;
      if (!wire.downloaded) return onvalidatewire(wire);
      select(wire, false) || select(wire, true);
    };

    var onupdate = function () {
      wires.forEach(onupdatewire);
    };

    const onwire = function (wire) {
      wire.setTimeout(opts.timeout || REQUEST_TIMEOUT, function () {
        engine.emit('timeout', wire);
        wire.destroy();
      });

      if (engine.selection.length) wire.interested();

      let id = null;
      const onchoketimeout = function () {
        if (
          swarm.queued > 2 * (swarm.size - swarm.wires.length) &&
          wire.amInterested
        ) {
          return wire.destroy();
        }
        id = setTimeout(onchoketimeout, CHOKE_TIMEOUT);
      };

      wire.on('close', function () {
        clearTimeout(id);
      });
      wire.on('choke', function () {
        clearTimeout(id);
        id = setTimeout(onchoketimeout, CHOKE_TIMEOUT);
      });
      wire.on('unchoke', function () {
        clearTimeout(id);
      });

      wire.on('request', function (index, offset, length, reqCb) {
        if (pieces[index]) return;
        engine.store.get(
          index,
          { offset: offset, length: length },
          function (err, buffer) {
            if (err) return reqCb(err);
            engine.emit('upload', index, offset, length);
            reqCb(null, buffer);
          }
        );
      });

      wire.on('unchoke', onupdate);
      wire.on('bitfield', onupdate);
      wire.on('have', onupdate);

      wire.isSeeder = false;
      let sIdx = 0;
      const checkseeder = function () {
        if (wire.peerPieces.length !== torrent.pieces.length) return;
        for (; sIdx < torrent.pieces.length; ++sIdx) {
          if (!wire.peerPieces[sIdx]) return;
        }
        wire.isSeeder = true;
      };
      wire.on('bitfield', checkseeder);
      wire.on('have', checkseeder);
      checkseeder();

      wire.badPieceStrikes = [];
      id = setTimeout(onchoketimeout, CHOKE_TIMEOUT);
    };

    const rechokeSort = function (a, b) {
      if (a.downSpeed !== b.downSpeed) return a.downSpeed > b.downSpeed ? -1 : 1;
      if (a.upSpeed !== b.upSpeed) return a.upSpeed > b.upSpeed ? -1 : 1;
      if (a.wasChoked !== b.wasChoked) return a.wasChoked ? 1 : -1;
      return a.salt - b.salt;
    };

    const onrechoke = function () {
      if (rechokeOptimisticTime > 0) --rechokeOptimisticTime;
      else rechokeOptimistic = null;

      const peers = [];
      wires.forEach(function (wire) {
        if (wire.isSeeder) {
          if (!wire.amChoking) wire.choke();
        } else if (wire !== rechokeOptimistic) {
          peers.push({
            wire: wire,
            downSpeed: wire.downloadSpeed(),
            upSpeed: wire.uploadSpeed(),
            salt: Math.random(),
            interested: wire.peerInterested,
            wasChoked: wire.amChoking,
            isChoked: true,
          });
        }
      });

      peers.sort(rechokeSort);

      let i = 0;
      let unchokeInterested = 0;
      for (; i < peers.length && unchokeInterested < rechokeSlots; ++i) {
        peers[i].isChoked = false;
        if (peers[i].interested) ++unchokeInterested;
      }

      if (!rechokeOptimistic && i < peers.length && rechokeSlots) {
        const candidates = peers.slice(i).filter(function (p) {
          return p.interested;
        });
        const optimistic = candidates[(Math.random() * candidates.length) | 0];
        if (optimistic) {
          optimistic.isChoked = false;
          rechokeOptimistic = optimistic.wire;
          rechokeOptimisticTime = RECHOKE_OPTIMISTIC_DURATION;
        }
      }

      peers.forEach(function (p) {
        if (p.wasChoked !== p.isChoked) {
          if (p.isChoked) p.wire.choke();
          else p.wire.unchoke();
        }
      });
    };

    const onready = function () {
      if (destroyed) return;
      swarm.on('wire', onwire);
      swarm.wires.forEach(onwire);

      refresh = function () {
        process.nextTick(gc);
        oninterestchange();
        onupdate();
      };

      rechokeIntervalId = setInterval(onrechoke, RECHOKE_INTERVAL);

      process.nextTick(function () {
        engine.emit('torrent', torrent);
        engine.emit('ready');
        refresh();

        // Non-blocking background verification of existing disk pieces (yields event loop every piece)
        if (hasExistingFilesOnDisk && opts.verify !== false) {
          let bgIdx = 0;
          const stepBgVerify = function () {
            if (destroyed || bgIdx >= torrent.pieces.length) {
              if (!destroyed && bgIdx >= torrent.pieces.length) {
                engine.emit('verify-complete');
              }
              return;
            }
            const cur = bgIdx++;
            if (!pieces[cur] || diskCheckAttempted[cur]) {
              setImmediate(stepBgVerify);
              return;
            }
            engine._tryVerifyDiskPiece(cur, function () {
              setTimeout(stepBgVerify, 2);
            });
          };
          setTimeout(stepBgVerify, 50);
        }
      });
    };

    // Emit 'ready' IMMEDIATELY (<10ms!) while FastFileStream verifies requested pieces on-demand in 2ms
    onready();
  };

  const exchange = createExchangeMetadata(engine, function (rawMeta) {
    const buf = bncode.encode({
      info: bncode.decode(rawMeta),
      'announce-list': [],
    });
    ontorrent(parseTorrent(buf));
    mkdirp(path.dirname(torrentPath), function (err) {
      if (err) return engine.emit('error', err);
      fs.writeFile(torrentPath, buf, function (wErr) {
        if (wErr) engine.emit('error', wErr);
      });
    });
  });

  swarm.on('wire', function (wire) {
    engine.emit('wire', wire);
    exchange(wire);
    if (engine.bitfield) wire.bitfield(engine.bitfield);
  });

  swarm.pause();

  if (link.files && engine.metadata) {
    swarm.resume();
    ontorrent(link);
  } else {
    fs.readFile(torrentPath, function (_, buf) {
      if (destroyed) return;
      swarm.resume();
      if (!buf) return discovery.setTorrent(link);
      const parsed = parseTorrent(buf);
      if (parsed.infoHash !== infoHash) return discovery.setTorrent(link);
      if (!parsed.announce || !parsed.announce.length) {
        opts.trackers = [].concat(opts.trackers || []).concat(link.announce || []);
      }
      engine.metadata = parsed.infoBuffer;
      ontorrent(parsed);
    });
  }

  engine.critical = function (pieceIdx, width) {
    const count = width || 1;
    for (let i = 0; i < count; i++) {
      critical[pieceIdx + i] = true;
    }
  };

  engine.select = function (from, to, priority, notify) {
    // Use unshift before stable priority sort so the latest seek Range request (e.g. MKV Cues or Skip Intro target)
    // ALWAYS takes selection[0] ahead of any older lingering stream!
    engine.selection.unshift({
      from: from,
      to: to,
      offset: 0,
      priority: toNumber(priority),
      notify: notify || noop,
    });
    engine.selection.sort(function (a, b) {
      return b.priority - a.priority;
    });
    refresh();
  };

  engine.deselect = function (from, to, priority, notify) {
    notify = notify || noop;
    for (let i = 0; i < engine.selection.length; i++) {
      const s = engine.selection[i];
      if (s.from !== from || s.to !== to) continue;
      if (s.priority !== toNumber(priority)) continue;
      if (s.notify !== notify) continue;
      engine.selection.splice(i, 1);
      i--;
      break;
    }
    refresh();
  };

  engine.connect = function (addr) {
    swarm.add(addr);
  };

  engine.disconnect = function (addr) {
    swarm.remove(addr);
  };

  engine.block = function (addr) {
    blocked.add(addr.split(':')[0]);
    engine.disconnect(addr);
    engine.emit('blocking', addr);
  };

  engine.destroy = function (destroyCb) {
    destroyed = true;
    swarm.destroy();
    if (rechokeIntervalId) clearInterval(rechokeIntervalId);
    discovery.stop();
    if (engine.store && engine.store.close) {
      engine.store.close(destroyCb);
    } else if (destroyCb) {
      process.nextTick(destroyCb);
    }
  };

  engine.listen = function (port, listenCb) {
    if (typeof port === 'function') return engine.listen(0, port);
    const net = require('node:net');
    const findPort = function (def, fn) {
      const s = net.createServer();
      s.on('error', function () {
        findPort(0, fn);
      });
      s.listen(def, function () {
        const p = s.address().port;
        s.close(function () {
          engine.listen(p, fn);
        });
      });
    };
    if (!port) return findPort(opts.port || DEFAULT_PORT, listenCb);
    engine.port = port;
    swarm.listen(engine.port, listenCb);
    discovery.updatePort(engine.port);
  };

  return engine;
}

module.exports = fastTorrentStream;

