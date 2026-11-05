import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Upload,
  Check,
  ShieldCheck,
  UserCheck,
  Delete,
} from 'lucide-react';
import {
  SharedTvProfile,
  PHOTO_AVATAR_GALLERY,
  detectCurrentDeviceName,
  saveSharedProfiles,
  saveSharedActiveProfileId,
  isProfileRememberedOnDevice,
  rememberProfileOnDevice,
  forgetProfileOnDevice,
  compressUploadedAvatarImage,
} from '../../services/deviceContinuityService';

interface HandoffMediaInfo {
  id: string;
  name: string;
  type: 'movie' | 'series';
  poster?: string;
  season?: number;
  episode?: number;
  currentTime?: number;
}

interface CrossDeviceHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: SharedTvProfile[];
  activeProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onProfilesChange?: (profiles: SharedTvProfile[]) => void;
  activeMedia?: HandoffMediaInfo | null;
  uiLang?: 'ro' | 'en' | 'ru';
  initialMode?: 'list' | 'create' | 'pin_unlock';
  isPinLockRequired?: boolean;
}

const ON_SCREEN_KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
  '4', '5', '6', '7', '8', '9',
];

export const CrossDeviceHandoffModal: React.FC<CrossDeviceHandoffModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  onSelectProfile,
  onProfilesChange,
  uiLang = 'ro',
  initialMode = 'list',
  isPinLockRequired = false,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'pin_prompt' | 'edit'>('list');
  const [isManageMode, setIsManageMode] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabel] = useState<string>('Dispozitiv');

  // PIN unlock state
  const [targetPinProfile, setTargetPinProfile] = useState<SharedTvProfile | null>(null);
  const [pendingPinAction, setPendingPinAction] = useState<'select' | 'edit' | 'delete'>('select');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const firstDigitBtnRef = useRef<HTMLButtonElement | null>(null);

  // Create / Edit account state
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null); // 'NEW' or profile.id
  const [draftName, setDraftName] = useState<string>('');
  const [draftPin, setDraftPin] = useState<string>('');
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string>(
    PHOTO_AVATAR_GALLERY[0].avatarUrl
  );
  const [draftAvatarEmoji, setDraftAvatarEmoji] = useState<string>('EU');
  const [draftAvatarBg, setDraftAvatarBg] = useState<string>(
    PHOTO_AVATAR_GALLERY[0].bg
  );
  const [draftLang, setDraftLang] = useState<'ro' | 'en' | 'ru'>('ro');
  const [draftIsKids, setDraftIsKids] = useState<boolean>(false);
  const [showTvKeyboard, setShowTvKeyboard] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tr = (ro: string, en: string, ru: string) =>
    uiLang === 'en' ? en : uiLang === 'ru' ? ru : ro;

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0];

  useEffect(() => {
    if (!isOpen) return;
    setDeviceLabel(detectCurrentDeviceName());
    if (initialMode === 'create') {
      startCreateNewAccount();
    } else if (
      (initialMode === 'pin_unlock' || isPinLockRequired) &&
      activeProfile?.pin &&
      activeProfile.pin.trim()
    ) {
      setTargetPinProfile(activeProfile);
      setPendingPinAction('select');
      setEnteredPin('');
      setPinError('');
      setViewMode('pin_prompt');
    } else {
      setViewMode('list');
      setIsManageMode(false);
      setTargetPinProfile(null);
      setEnteredPin('');
      setPinError('');
    }
  }, [isOpen, initialMode, isPinLockRequired, activeProfile?.id]);

  useEffect(() => {
    if (!isOpen || viewMode !== 'pin_prompt') return;
    const t = window.setTimeout(() => {
      firstDigitBtnRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [isOpen, viewMode, targetPinProfile?.id]);

  // Allow typing digits 0-9 or Backspace directly on the TV remote / keyboard when PIN prompt is open
  useEffect(() => {
    if (!isOpen || viewMode !== 'pin_prompt') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        setPinError('');
        setEnteredPin((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, viewMode, targetPinProfile?.id, pendingPinAction]);

  const applyUpdatedProfiles = (nextList: SharedTvProfile[]) => {
    saveSharedProfiles(nextList);
    onProfilesChange?.(nextList);
  };

  const openEditorForProfile = (prof: SharedTvProfile) => {
    setEditingProfileId(prof.id);
    setDraftName(prof.name);
    setDraftPin(prof.pin || '');
    setDraftAvatarUrl(
      prof.avatarUrl || PHOTO_AVATAR_GALLERY[0].avatarUrl
    );
    setDraftAvatarEmoji(prof.avatarEmoji || 'EU');
    setDraftAvatarBg(prof.avatarBg || PHOTO_AVATAR_GALLERY[0].bg);
    setDraftLang(prof.uiLang || uiLang);
    setDraftIsKids(Boolean(prof.isKids));
    setUploadError('');
    setViewMode('edit');
  };

  const performDeleteAccount = (idToDelete: string) => {
    if (profiles.length <= 1) return;
    const nextList = profiles.filter((p) => p.id !== idToDelete);
    applyUpdatedProfiles(nextList);
    forgetProfileOnDevice(idToDelete);
    if (activeProfileId === idToDelete && nextList[0]) {
      saveSharedActiveProfileId(nextList[0].id);
      onSelectProfile(nextList[0].id);
    }
    setViewMode('list');
  };

  const handleAccountClick = (prof: SharedTvProfile) => {
    // Only require PIN the first time on this device (unless explicitly locked)
    if (prof.pin && prof.pin.trim() && !isProfileRememberedOnDevice(prof)) {
      setTargetPinProfile(prof);
      setPendingPinAction('select');
      setEnteredPin('');
      setPinError('');
      setViewMode('pin_prompt');
      return;
    }

    rememberProfileOnDevice(prof);
    saveSharedActiveProfileId(prof.id);
    onSelectProfile(prof.id);
    onClose();
  };

  const handleVerifyPin = (pinToCheck?: string) => {
    if (!targetPinProfile) return;
    const candidate = (pinToCheck ?? enteredPin).trim();
    const expected = (targetPinProfile.pin || '').trim();
    if (candidate === expected) {
      rememberProfileOnDevice(targetPinProfile);
      try {
        sessionStorage.setItem(
          `smartcinema_pin_verified_${targetPinProfile.id}`,
          expected
        );
      } catch {
        // ignore storage errors
      }
      if (pendingPinAction === 'edit') {
        const profToEdit = targetPinProfile;
        setTargetPinProfile(null);
        setEnteredPin('');
        openEditorForProfile(profToEdit);
        return;
      }
      if (pendingPinAction === 'delete') {
        const idToDel = targetPinProfile.id;
        setTargetPinProfile(null);
        setEnteredPin('');
        performDeleteAccount(idToDel);
        return;
      }
      saveSharedActiveProfileId(targetPinProfile.id);
      onSelectProfile(targetPinProfile.id);
      setViewMode('list');
      setTargetPinProfile(null);
      onClose();
    } else {
      setPinError(
        tr(
          'Cod PIN incorect! Încearcă din nou.',
          'Incorrect PIN code! Try again.',
          'Неверный PIN-код! Попробуйте снова.'
        )
      );
      setEnteredPin('');
    }
  };

  const handleDigitPress = (digit: string) => {
    setPinError('');
    setEnteredPin((prev) => {
      const maxLen = Math.max(4, targetPinProfile?.pin?.trim().length || 4);
      const next = (prev + digit).slice(0, maxLen);
      if (
        next.length === (targetPinProfile?.pin?.trim().length || 4) &&
        targetPinProfile
      ) {
        window.setTimeout(() => handleVerifyPin(next), 120);
      }
      return next;
    });
  };

  const startCreateNewAccount = () => {
    const nextPreset =
      PHOTO_AVATAR_GALLERY[profiles.length % PHOTO_AVATAR_GALLERY.length];
    setEditingProfileId('NEW');
    setDraftName('');
    setDraftPin('');
    setDraftAvatarUrl(nextPreset.avatarUrl);
    setDraftAvatarEmoji(nextPreset.emoji);
    setDraftAvatarBg(nextPreset.bg);
    setDraftLang(uiLang);
    setDraftIsKids(false);
    setUploadError('');
    setViewMode('edit');
  };

  const startEditAccount = (prof: SharedTvProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (prof.pin && prof.pin.trim()) {
      setTargetPinProfile(prof);
      setPendingPinAction('edit');
      setEnteredPin('');
      setPinError('');
      setViewMode('pin_prompt');
      return;
    }
    openEditorForProfile(prof);
  };

  const handleSaveAccount = () => {
    const cleanName =
      draftName.trim() ||
      tr(
        `Cont ${profiles.length + 1}`,
        `User ${profiles.length + 1}`,
        `Профиль ${profiles.length + 1}`
      );
    const cleanPin = draftPin.replace(/\D/g, '').slice(0, 6);

    if (editingProfileId === 'NEW') {
      const newProf: SharedTvProfile = {
        id: `acc_${Date.now()}`,
        name: cleanName,
        avatarEmoji: draftAvatarEmoji,
        avatarUrl: draftAvatarUrl,
        avatarBg: draftAvatarBg,
        pin: cleanPin || undefined,
        uiLang: draftLang,
        isKids: draftIsKids,
      };
      const nextList = [...profiles, newProf];
      applyUpdatedProfiles(nextList);
      rememberProfileOnDevice(newProf);
      if (cleanPin) {
        try {
          sessionStorage.setItem(`smartcinema_pin_verified_${newProf.id}`, cleanPin);
        } catch {
          // ignore
        }
      }
      saveSharedActiveProfileId(newProf.id);
      onSelectProfile(newProf.id);
      setViewMode('list');
      onClose();
    } else if (editingProfileId) {
      const updatedProf: SharedTvProfile = {
        id: editingProfileId,
        name: cleanName,
        avatarEmoji: draftAvatarEmoji,
        avatarUrl: draftAvatarUrl,
        avatarBg: draftAvatarBg,
        pin: cleanPin || undefined,
        uiLang: draftLang,
        isKids: draftIsKids,
      };
      const nextList = profiles.map((p) =>
        p.id === editingProfileId ? updatedProf : p
      );
      applyUpdatedProfiles(nextList);
      rememberProfileOnDevice(updatedProf);
      if (cleanPin) {
        try {
          sessionStorage.setItem(`smartcinema_pin_verified_${updatedProf.id}`, cleanPin);
        } catch {
          // ignore
        }
      }
      setViewMode('list');
    }
  };

  const handleDeleteAccount = (idToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (profiles.length <= 1) return;
    const prof = profiles.find((p) => p.id === idToDelete);
    if (prof?.pin && prof.pin.trim()) {
      setTargetPinProfile(prof);
      setPendingPinAction('delete');
      setEnteredPin('');
      setPinError('');
      setViewMode('pin_prompt');
      return;
    }
    performDeleteAccount(idToDelete);
  };

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      const compressedDataUrl = await compressUploadedAvatarImage(file);
      setDraftAvatarUrl(compressedDataUrl);
    } catch {
      setUploadError(
        tr(
          'Nu am putut încărca poza. Alege altă imagine.',
          'Could not load photo. Choose another image.',
          'Не удалось загрузить фото.'
        )
      );
    } finally {
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-handoff-modal="true"
      className="fixed inset-0 z-[220] bg-[radial-gradient(ellipse_at_top,_rgba(110,14,14,0.45)_0%,_rgba(12,12,12,0.97)_55%,_#080808_100%)] backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8 overflow-y-auto select-none"
      onClick={() => {
        if (!isPinLockRequired && viewMode === 'list') onClose();
      }}
    >
      {/* VIEW 1: NETFLIX-STYLE FULLSCREEN "WHO'S WATCHING?" ON A SINGLE HORIZONTAL ROW */}
      {viewMode === 'list' ? (
        <div
          className="relative w-full max-w-6xl my-auto flex flex-col items-center justify-center py-8 sm:py-12"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top-Right Close Button */}
          {!isPinLockRequired && (
            <button
              type="button"
              onClick={onClose}
              className="fixed top-6 right-6 sm:top-8 sm:right-8 h-10 px-4 rounded-full bg-white/10 hover:bg-white hover:text-zinc-950 focus:bg-white focus:text-zinc-950 focus:outline-none text-zinc-300 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>{tr('Închide', 'Close', 'Закрыть')}</span>
            </button>
          )}

          {/* Centered Netflix Heading */}
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white text-center mb-10 sm:mb-14">
            {isManageMode
              ? tr(
                  'Administrează profilurile:',
                  'Manage Profiles:',
                  'Управление профилями:'
                )
              : tr('Cine vizionează?', "Who's watching?", 'Кто смотрит?')}
          </h2>

          {/* Single Horizontal Row: All Profiles + Add Profile */}
          <div className="w-full overflow-x-auto no-scrollbar py-3">
            <div className="flex flex-nowrap items-start justify-center gap-5 sm:gap-7 md:gap-8 min-w-max mx-auto px-4">
              {profiles.map((prof, idx) => {
                const isActive = prof.id === activeProfileId;
                const hasPin = Boolean(prof.pin && prof.pin.trim());
                const isKidsProf =
                  Boolean(prof.isKids) || prof.name.toLowerCase() === 'kids';
                const kidsPreset =
                  PHOTO_AVATAR_GALLERY.find((g) => g.id === 'av_kids') ||
                  PHOTO_AVATAR_GALLERY[4];
                const avatarSrc = isKidsProf &&
                  (!prof.avatarUrl ||
                    prof.avatarUrl.includes('font-size%3D%2244%22') ||
                    prof.avatarUrl.includes('JUNIOR'))
                  ? kidsPreset.avatarUrl
                  : prof.avatarUrl ||
                    PHOTO_AVATAR_GALLERY[idx % PHOTO_AVATAR_GALLERY.length]
                      .avatarUrl;

                return (
                  <div
                    key={prof.id}
                    className="group relative flex flex-col items-center shrink-0 w-28 sm:w-36 md:w-40"
                  >
                    <button
                      type="button"
                      autoFocus={isActive || idx === 0}
                      onClick={(e) => {
                        if (isManageMode) {
                          startEditAccount(prof, e);
                        } else {
                          handleAccountClick(prof);
                        }
                      }}
                      className="w-full flex flex-col items-center focus:outline-none cursor-pointer"
                    >
                      {/* Square Rounded Avatar (Netflix Style) */}
                      <div
                        className={`relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden shadow-[0_14px_34px_rgba(0,0,0,0.65)] transition-all duration-200 group-hover:scale-105 group-focus:scale-105 group-hover:ring-4 group-hover:ring-white group-focus:ring-4 group-focus:ring-white bg-zinc-900 ${
                          isActive && !isManageMode
                            ? 'ring-2 ring-white/80'
                            : ''
                        }`}
                      >
                        <img
                          src={avatarSrc}
                          alt={prof.name}
                          className="w-full h-full object-cover"
                        />

                        {/* Manage Mode Overlay (Classic Netflix Pencil Overlay) */}
                        {isManageMode && (
                          <div className="absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity">
                            <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-white bg-black/40">
                              <Pencil className="w-5 h-5" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Profile Name Underneath */}
                      <span className="mt-3.5 text-base sm:text-lg font-medium text-zinc-400 group-hover:text-white group-focus:text-white transition-colors truncate max-w-full">
                        {prof.name}
                      </span>

                      {/* Discreet Lock Icon Underneath Name if PIN-protected */}
                      {hasPin && (
                        <span className="mt-1 inline-flex items-center gap-1 text-zinc-500 group-hover:text-zinc-300">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>

                    {/* Quick Edit / Delete mini pill on hover or in Manage Mode */}
                    {isManageMode ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => startEditAccount(prof, e)}
                          className="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white hover:text-zinc-950 text-[11px] font-bold text-zinc-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>{tr('Editează', 'Edit', 'Изм.')}</span>
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAccount(prof.id, e)}
                            title={tr('Șterge profilul', 'Delete profile', 'Удалить')}
                            className="h-7 w-7 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => startEditAccount(prof, e)}
                        title={tr(
                          'Editează poza, numele sau PIN-ul',
                          'Edit photo, name or PIN',
                          'Изменить фото, имя или PIN'
                        )}
                        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/65 hover:bg-white text-zinc-200 hover:text-zinc-950 border border-white/20 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add Profile Square on the Exact Same Row */}
              <div className="group flex flex-col items-center shrink-0 w-28 sm:w-36 md:w-40">
                <button
                  type="button"
                  onClick={startCreateNewAccount}
                  className="w-full flex flex-col items-center focus:outline-none cursor-pointer"
                >
                  <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl bg-white/[0.06] group-hover:bg-white group-focus:bg-white border border-white/15 flex items-center justify-center text-zinc-400 group-hover:text-zinc-950 group-focus:text-zinc-950 shadow-[0_14px_34px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:scale-105 group-focus:scale-105">
                    <Plus className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
                  </div>
                  <span className="mt-3.5 text-base sm:text-lg font-medium text-zinc-400 group-hover:text-white group-focus:text-white transition-colors truncate max-w-full">
                    {tr('Adaugă profil', 'Add Profile', 'Добавить')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Netflix "Manage Profiles" Button */}
          <div className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsManageMode((prev) => !prev)}
              className={`h-10 px-7 rounded-md text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                isManageMode
                  ? 'bg-white text-zinc-950 hover:bg-zinc-200 font-extrabold'
                  : 'border border-zinc-500 hover:border-white text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              {isManageMode
                ? tr('Gata', 'Done', 'Готово')
                : tr(
                    'Administrează profilurile',
                    'Manage Profiles',
                    'Управление профилями'
                  )}
            </button>

            {activeProfile?.pin && (
              <button
                type="button"
                onClick={() => {
                  forgetProfileOnDevice(activeProfile.id);
                  setTargetPinProfile(activeProfile);
                  setEnteredPin('');
                  setViewMode('pin_prompt');
                }}
                className="h-10 px-5 rounded-md border border-zinc-600 hover:border-amber-400 text-zinc-400 hover:text-amber-300 text-xs sm:text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{tr('Blochează PIN', 'Lock PIN', 'Заблокировать')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="w-full max-w-4xl rounded-[32px] tahoe-glass text-white overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar for PIN / Edit Views */}
          <div className="px-6 py-4 bg-white/[0.04] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-extrabold tracking-tight text-white">
                  {viewMode === 'edit'
                    ? editingProfileId === 'NEW'
                      ? tr(
                          'Creează Cont / Profil Nou',
                          'Create New Account / Profile',
                          'Создать новый аккаунт'
                        )
                      : tr(
                          'Editează Contul & Poza de Profil',
                          'Edit Account & Profile Photo',
                          'Редактировать профиль'
                        )
                    : tr(
                        `Introdu PIN-ul pentru ${targetPinProfile?.name || ''}`,
                        `Enter PIN for ${targetPinProfile?.name || ''}`,
                        `Введите PIN для ${targetPinProfile?.name || ''}`
                      )}
                </h2>
                <p className="text-xs text-zinc-400">
                  {tr(
                    `Dispozitiv curent: ${deviceLabel}`,
                    `Current device: ${deviceLabel}`,
                    `Устройство: ${deviceLabel}`
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="h-9 px-4 rounded-full bg-white/10 hover:bg-white hover:text-zinc-950 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-extrabold transition-colors cursor-pointer"
              >
                ← {tr('Înapoi la Conturi', 'Back to Profiles', 'Назад')}
              </button>
              {!isPinLockRequired && (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-full bg-white/10 hover:bg-rose-600 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>{tr('Închide', 'Close', 'Закрыть')}</span>
                </button>
              )}
            </div>
          </div>

        {/* VIEW 2: 4-DIGIT PIN PAD FOR PROTECTED ACCOUNTS */}
        {viewMode === 'pin_prompt' && targetPinProfile && (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center max-w-md mx-auto space-y-5">
            <img
              src={
                targetPinProfile.avatarUrl || PHOTO_AVATAR_GALLERY[0].avatarUrl
              }
              alt={targetPinProfile.name}
              className="w-24 h-24 rounded-3xl object-cover border-2 border-blue-400 shadow-2xl"
            />
            <div>
              <h3 className="text-xl font-extrabold text-white">
                {targetPinProfile.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {pendingPinAction === 'edit'
                  ? tr(
                      'Introdu codul PIN pentru a edita acest cont',
                      'Enter PIN to edit this account',
                      'Введите PIN для редактирования'
                    )
                  : pendingPinAction === 'delete'
                    ? tr(
                        'Introdu codul PIN pentru a șterge acest cont',
                        'Enter PIN to delete this account',
                        'Введите PIN для удаления'
                      )
                    : tr(
                        'Introdu codul PIN de 4 cifre cu telecomanda sau de pe ecran',
                        'Enter the 4-digit PIN using your remote or on-screen pad',
                        'Введите 4-значный PIN с пульта или на экране'
                      )}
              </p>
            </div>

            {/* PIN Boxes / Input */}
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => {
                setPinError('');
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setEnteredPin(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleVerifyPin();
                }
              }}
              placeholder="••••"
              className="w-48 h-14 rounded-2xl bg-black border-2 border-white/25 focus:border-blue-400 text-center text-3xl font-mono tracking-[0.5em] text-white focus:outline-none"
            />

            {pinError && (
              <div className="text-xs font-extrabold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-4 py-2 rounded-xl">
                {pinError}
              </div>
            )}

            {/* On-Screen Number Pad (for Smart TV Remote & iPad Touch) */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  ref={digit === '1' ? firstDigitBtnRef : undefined}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  className="h-12 rounded-2xl bg-[#242424] hover:bg-white hover:text-zinc-950 focus:bg-blue-400 focus:text-zinc-950 text-lg font-extrabold border border-white/10 transition-colors cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEnteredPin('')}
                className="h-12 rounded-2xl bg-[#242424] hover:bg-rose-600 focus:bg-rose-600 focus:text-white text-xs font-extrabold text-rose-300 hover:text-white border border-white/10 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="h-12 rounded-2xl bg-[#242424] hover:bg-white hover:text-zinc-950 focus:bg-blue-400 focus:text-zinc-950 text-lg font-extrabold border border-white/10 transition-colors cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setEnteredPin((p) => p.slice(0, -1))}
                className="h-12 rounded-2xl bg-[#242424] hover:bg-zinc-700 focus:bg-zinc-600 focus:text-white text-xs font-extrabold text-zinc-300 flex items-center justify-center border border-white/10 cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleVerifyPin()}
              className="w-full h-12 rounded-2xl bg-blue-400 hover:bg-blue-300 focus:bg-white focus:text-zinc-950 text-zinc-950 font-extrabold text-sm shadow-lg cursor-pointer"
            >
              ✓ {tr('Deblochează Contul', 'Unlock Account', 'Разблокировать')}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="w-full h-10 rounded-2xl bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 text-zinc-300 font-bold text-xs cursor-pointer"
            >
              ← {tr('Alege alt cont (Family / Guest / Kids)', 'Switch to another account', 'Выбрать другой профиль')}
            </button>
          </div>
        )}

        {/* VIEW 3: CREATE OR EDIT ACCOUNT (NAME + PHOTO PICKER / UPLOAD + PIN) */}
        {viewMode === 'edit' && (
          <div className="p-5 sm:p-7 space-y-6">
            {/* Top Preview + Upload Custom Photo + Name & PIN Inputs */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-[#202020] p-5 rounded-3xl border border-white/10">
              {/* Avatar Preview + Upload Button */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 border-blue-400 shadow-2xl bg-zinc-900">
                  <img
                    src={draftAvatarUrl}
                    alt={draftName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-3.5 rounded-xl bg-blue-500/20 hover:bg-blue-400 hover:text-zinc-950 border border-blue-400/50 text-blue-300 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'Încarcă Poza Ta',
                      'Upload Your Photo',
                      'Загрузить свое фото'
                    )}
                  </span>
                </button>
                {uploadError && (
                  <span className="text-[11px] text-rose-400 font-bold">
                    {uploadError}
                  </span>
                )}
              </div>

              {/* Name + PIN + Language Form */}
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Account Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-blue-300">
                      {tr('Nume Cont / Utilizator:', 'Account Name:', 'Имя пользователя:')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder={tr('Ex: Eugeniu, Maria, Alex...', 'E.g. John, Maria...', 'Например: Евгений...')}
                        className="flex-1 h-11 px-4 rounded-xl bg-[#121212] border border-white/20 focus:border-blue-400 text-sm sm:text-base font-extrabold text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTvKeyboard((v) => !v)}
                        title="Tastatură pe ecran pentru telecomanda TV"
                        className="h-11 px-3 rounded-xl bg-white/10 hover:bg-white hover:text-zinc-950 text-xs font-extrabold shrink-0 cursor-pointer"
                      >
                        ⌨ TV
                      </button>
                    </div>
                  </div>

                  {/* Optional 4-Digit PIN */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      {tr(
                        'Cod PIN (4 cifre — opțional):',
                        'PIN Code (4 digits — optional):',
                        'PIN-код (4 цифры — необязательно):'
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={draftPin}
                        onChange={(e) =>
                          setDraftPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder={tr(
                          'Fără PIN (sau ex: 1234)',
                          'No PIN (or e.g. 1234)',
                          'Без PIN (или 1234)'
                        )}
                        className="w-full h-11 px-4 rounded-xl bg-[#121212] border border-white/20 focus:border-amber-400 text-sm sm:text-base font-mono font-extrabold text-white focus:outline-none"
                      />
                      {draftPin && (
                        <button
                          type="button"
                          onClick={() => setDraftPin('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 hover:bg-rose-600 hover:text-white"
                        >
                          Șterge PIN
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* On-Screen TV Keyboard when toggled */}
                {showTvKeyboard && (
                  <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-zinc-400">
                        {tr('Tastatură Telecomandă TV:', 'TV Remote Keyboard:', 'Экранная клавиатура:')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDraftName((s) => s + ' ')}
                          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white hover:text-zinc-950 text-xs font-bold"
                        >
                          Spațiu
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftName((s) => s.slice(0, -1))}
                          className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold"
                        >
                          ⌫ Șterge
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-9 sm:grid-cols-12 gap-1">
                      {ON_SCREEN_KEYS.map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setDraftName((s) => s + ch)}
                          className="h-9 rounded-lg bg-[#222222] hover:bg-blue-400 hover:text-zinc-950 focus:bg-blue-400 focus:text-zinc-950 text-xs font-extrabold text-white transition-colors"
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Language Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400">
                      {tr('Limba contului:', 'Account language:', 'Язык профиля:')}
                    </span>
                    {(
                      [
                        { id: 'ro', label: 'RO • Română' },
                        { id: 'en', label: 'EN • English' },
                        { id: 'ru', label: 'RU • Русский' },
                      ] as const
                    ).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setDraftLang(l.id)}
                        className={`h-8 px-3 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                          draftLang === l.id
                            ? 'bg-[#1e3a8a] text-white'
                            : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-blue-300">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {tr(
                        'Se ține minte automat după prima autentificare',
                        'Automatically remembered after first sign-in',
                        'Автоматически запоминается после первого входа'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 16 Built-in HD Portrait Avatar Gallery */}
            <div className="space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                {tr(
                  'Alege o Poză de Profil din Galerie (sau încarcă poza ta mai sus):',
                  'Choose a Profile Photo from the Gallery (or upload your own above):',
                  'Выберите аватар из галереи (или загрузите свое фото выше):'
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                {PHOTO_AVATAR_GALLERY.map((preset) => {
                  const selected = draftAvatarUrl === preset.avatarUrl;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setDraftAvatarUrl(preset.avatarUrl);
                        setDraftAvatarEmoji(preset.emoji);
                        setDraftAvatarBg(preset.bg);
                      }}
                      className={`group relative rounded-2xl overflow-hidden border-2 transition-all focus:outline-none cursor-pointer ${
                        selected
                          ? 'border-blue-400 ring-4 ring-blue-400/30 scale-105'
                          : 'border-white/10 opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      <img
                        src={preset.avatarUrl}
                        alt={preset.label}
                        className="w-full aspect-square object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save & Cancel Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveAccount}
                  className="h-11 px-6 rounded-2xl bg-blue-400 hover:bg-blue-300 text-zinc-950 font-extrabold text-sm shadow-lg cursor-pointer"
                >
                  ✓{' '}
                  {editingProfileId === 'NEW'
                    ? tr(
                        'Creează Contul & Intră',
                        'Create Account & Sign In',
                        'Создать и войти'
                      )
                    : tr(
                        'Salvează Modificările',
                        'Save Changes',
                        'Сохранить изменения'
                      )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="h-11 px-5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-200 font-bold text-sm cursor-pointer"
                >
                  {tr('Anulează', 'Cancel', 'Отмена')}
                </button>
              </div>

              {editingProfileId &&
                editingProfileId !== 'NEW' &&
                profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingProfileId)}
                    className="h-11 px-4 rounded-2xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {tr('Șterge acest cont', 'Delete this account', 'Удалить аккаунт')}
                    </span>
                  </button>
                )}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
};
