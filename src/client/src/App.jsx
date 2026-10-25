import { useState, useEffect, useCallback } from 'react';
import { getTodayDateIST, formatWorkingDays } from './utils/dateUtils.js';
import {
  fetchSpecialties,
  discoverDoctors,
  fetchDoctorProfile,
  fetchDoctorAvailability,
  createAppointment,
  fetchMyAppointments,
  cancelAppointment,
  searchStaffPatients,
  createWalkInPatient,
  registerWalkIn,
  fetchTodayStaffQueue,
  checkInAppointment,
  callNextPatient,
  startConsultation,
  completeConsultation,
  skipPatient,
  markNoShow,
  rejoinPatient,
  pauseQueue,
  resumeQueue,
  cancelQueueEntry,
  getPatientLiveQueue,
  fetchPublicQueueDisplay,
  submitPatientRating,
  fetchDoctorRatings,
  fetchPatientNotifications,
  markNotificationAsRead,
  fetchPatientInvoices,
  initiatePatientPayment,
  fetchStaffBillingSummary,
  processStaffRefund,
  fetchStaffDailyAnalytics,
  fetchDoctorMeAnalytics,
  fetchAdminAnalyticsSummary,
  fetchPatientQueuePrediction,
  fetchStaffQueueIntelligence,
  fetchStaffAnomalies,
  fetchDoctorOwnIntelligence,
  fetchAdminIntelligenceSummary,
  loginUser,
  registerUser,
  updateDoctorSelfStatus,
  fetchDoctorOwnAppointments,
  fetchDoctorOwnSchedule,
  updateDoctorScheduleSelf,
  selfCheckInAppointment,
  triageQueueEntry,
  transferQueueDoctor,
  fetchReconciliationPreview,
  closeClinicDay,
  fetchDailySettlements,
  downloadSettlementCSV,
  downloadInvoicesCSV,
  fetchQueueAuditHistory,
  fetchFinancialAuditHistory,
  getClinicOperationalPolicy,
  updateClinicOperationalPolicy,
  fetchAdminDoctors,
  updateDoctorScheduleAdmin,
  fetchStaffAppointments,
  fetchAdminClinics,
  fetchAdminStaff,
} from './services/api';
import './App.css';

// ----------------------------------------------------
// Clinical SVG Icons (Zero External Dependencies)
// ----------------------------------------------------
const IconPulse = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconLocation = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconActivity = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconPause = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const IconPlay = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// ----------------------------------------------------
// Verified Clinical Environment Photographic Assets
// ----------------------------------------------------
const HERO_SLIDES = [
  {
    id: 'consultation',
    src: '/images/hero/doctor-consultation.jpg',
    alt: 'Healthcare provider consulting attentively with a patient in a modern clinical room',
    caption: 'Modern clinical consultations & personalized care',
  },
  {
    id: 'clinical-space',
    src: '/images/hero/modern-clinical-space.jpg',
    alt: 'Bright, modern healthcare facility with clean consultation rooms',
    caption: 'Advanced outpatient care facilities & synchronized pacing',
  },
  {
    id: 'reception',
    src: '/images/hero/reception-care.jpg',
    alt: 'Welcoming clinic reception and organized patient check-in environment',
    caption: 'Frictionless patient arrival & organized queue check-in',
  },
  {
    id: 'telemetry',
    src: '/images/hero/clinical-telemetry.jpg',
    alt: 'Clinician reviewing patient records and digital schedule telemetry',
    caption: 'Real-time practitioner telemetry & intelligent queue orchestration',
  },
];

function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Calm automatic rotation every 7 seconds
  useEffect(() => {
    if (isPaused || isHovered || reducedMotion) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isPaused, isHovered, reducedMotion]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    }
  };

  const handleImageError = (index) => {
    setFailedImages((prev) => ({ ...prev, [index]: true }));
  };

  return (
    <div
      className="hero-carousel-frame"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Contemporary healthcare clinical environments"
    >
      <div className="hero-carousel-viewport">
        {HERO_SLIDES.map((slide, idx) => {
          const isActive = idx === currentSlide;
          const isFailed = failedImages[idx];

          return (
            <div
              key={slide.id}
              className={`hero-slide ${isActive ? 'active' : ''}`}
              aria-hidden={!isActive}
            >
              {isFailed ? (
                <div className="hero-slide-fallback">
                  <IconPulse />
                  <span>{slide.caption}</span>
                </div>
              ) : (
                <img
                  src={slide.src}
                  alt={slide.alt}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  onError={() => handleImageError(idx)}
                  className="hero-slide-img"
                />
              )}
            </div>
          );
        })}

        <div className="hero-carousel-overlay" />

        <div className="hero-carousel-caption" aria-live="polite">
          <span className="caption-dot" />
          <span className="caption-text">{HERO_SLIDES[currentSlide].caption}</span>
        </div>

        <div className="hero-carousel-controls">
          <div className="carousel-nav-buttons">
            <button
              type="button"
              className="carousel-control-btn"
              onClick={handlePrev}
              aria-label="Previous photograph"
              title="Previous photograph"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              className="carousel-control-btn"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? 'Resume rotation' : 'Pause rotation'}
              title={isPaused ? 'Resume rotation' : 'Pause rotation'}
              aria-pressed={isPaused}
            >
              {isPaused ? <IconPlay /> : <IconPause />}
            </button>
            <button
              type="button"
              className="carousel-control-btn"
              onClick={handleNext}
              aria-label="Next photograph"
              title="Next photograph"
            >
              <IconChevronRight />
            </button>
          </div>

          <div className="carousel-dots-group" role="tablist" aria-label="Slide indicators">
            {HERO_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                className={`carousel-dot ${idx === currentSlide ? 'active' : ''}`}
                aria-selected={idx === currentSlide}
                aria-label={`Slide ${idx + 1} of ${HERO_SLIDES.length}: ${slide.caption}`}
                onClick={() => setCurrentSlide(idx)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Premium Doctor Discovery Card Components (Phase 16 Fix 6)
// ----------------------------------------------------
function DoctorAvatar({ fullName, photoUrl }) {
  const [imgError, setImgError] = useState(false);
  const initials = fullName
    ? fullName
        .replace(/^Dr\.?\s*/i, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'DR'
    : 'DR';

  return (
    <div className="doctor-avatar-wrapper">
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={fullName ? `Photo of ${fullName}` : 'Specialist profile'}
          className="doctor-avatar-img"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="doctor-avatar-initials" aria-label={fullName || 'Doctor initials'}>
          {initials}
        </div>
      )}
      <span className="doctor-avail-indicator" title="Accepting Appointments" aria-hidden="true" />
    </div>
  );
}

function DoctorDiscoveryCard({ doctor, onOpenProfile, onBookAppointment }) {
  const d = doctor;
  const ratingVal = d.averageRating && d.averageRating > 0 ? d.averageRating.toFixed(1) : '5.0';
  const reviewsCount = d.totalReviews || 0;
  const reviewsLabel = reviewsCount > 0 ? `(${reviewsCount} reviews)` : '(New)';
  const expLabel = d.experienceYears ? `${d.experienceYears} yrs` : '5+ yrs';
  const feeLabel = `₹${d.consultationFee ?? 500}`;
  const durationLabel = d.averageConsultationDurationMinutes ? `~${d.averageConsultationDurationMinutes} mins` : '~15 mins';

  const clinicName = d.clinic?.name || 'Main Medical Center';
  const locationSubtext = d.distanceKm != null
    ? `${d.distanceKm} km away`
    : d.clinic?.city
      ? d.clinic.city
      : null;

  return (
    <article className="doctor-card" aria-label={`Doctor profile for ${d.fullName}`}>
      <div className="doc-card-content">
        <header className="doc-card-top">
          <DoctorAvatar fullName={d.fullName} photoUrl={d.photoUrl} />
          <div className="doc-identity-block">
            <h3 className="doc-name" title={d.fullName}>
              {d.fullName}
            </h3>
            <div className="doc-specialty-line">
              {d.specialty?.name || 'General Medicine'}
            </div>
            <div className="doc-clinic-meta" title={clinicName + (locationSubtext ? ` · ${locationSubtext}` : '')}>
              <IconLocation />
              <span className="doc-clinic-text">
                {clinicName}
                {locationSubtext && (
                  <span className="doc-clinic-location"> · {locationSubtext}</span>
                )}
              </span>
            </div>
          </div>
        </header>

        <div className="doc-attributes-grid" aria-label="Clinical background and consultation fees">
          <div className="doc-attribute-col">
            <span className="doc-attribute-label">Rating</span>
            <div className="doc-attribute-val rating-val">
              <IconStar />
              <span className="rating-score">{ratingVal}</span>
              <span className="rating-count">
                {reviewsCount > 0 ? (
                  <>({reviewsCount}<span className="reviews-word"> reviews</span>)</>
                ) : (
                  '(New)'
                )}
              </span>
            </div>
          </div>
          <div className="doc-attribute-col">
            <span className="doc-attribute-label">Experience</span>
            <div className="doc-attribute-val">
              {expLabel}
            </div>
          </div>
          <div className="doc-attribute-col">
            <span className="doc-attribute-label">Consultation</span>
            <div className="doc-attribute-val fee-val">
              {feeLabel}
              <span className="fee-unit">/ visit</span>
            </div>
          </div>
        </div>

        <div className="doc-schedule-note" title={d.hasSchedule && d.workingDays?.length > 0 ? `Available on ${formatWorkingDays(d.workingDays)}` : 'Schedule not configured yet'}>
          <IconCalendar />
          {d.hasSchedule && d.workingDays?.length > 0 ? (
            <span>
              <strong className="doc-schedule-configured">Available:</strong> {formatWorkingDays(d.workingDays)}
            </span>
          ) : (
            <span className="doc-schedule-unconfigured">Schedule not configured</span>
          )}
        </div>

        <div className="doc-session-note">
          <IconClock />
          <span>Typical session: {durationLabel}</span>
        </div>
      </div>

      <footer className="doctor-actions-row">
        <button
          type="button"
          className="btn btn-secondary doc-btn-profile"
          onClick={() => onOpenProfile(d._id)}
          aria-label={`View full profile for ${d.fullName}`}
        >
          View Profile
        </button>
        <button
          type="button"
          className="btn btn-primary doc-btn-book"
          onClick={() => onBookAppointment(d)}
          aria-label={`Book consultation appointment with ${d.fullName}`}
        >
          Book Consultation
        </button>
      </footer>
    </article>
  );
}

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const createEmptyWeeklyHours = () =>
  DAYS_OF_WEEK.map((day) => ({
    dayOfWeek: day,
    isWorkingDay: false,
    shifts: [],
    breaks: [],
  }));

export default function App() {
  // ----------------------------------------------------
  // Persistent Authentication & Role Session State (Phase 13)
  // ----------------------------------------------------
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = localStorage.getItem('qflow_auth_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    gender: 'MALE',
    dateOfBirth: '1995-01-01',
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Synchronize role tokens with session
  const currentRole = authSession?.user?.role || 'GUEST';
  const currentToken = authSession?.token || '';

  const [patientToken, setPatientToken] = useState(currentRole === 'PATIENT' ? currentToken : '');
  const [staffToken, setStaffToken] = useState((currentRole === 'STAFF' || currentRole === 'ADMIN') ? currentToken : '');
  const [doctorToken, setDoctorToken] = useState(currentRole === 'DOCTOR' ? currentToken : '');
  const [adminToken, setAdminToken] = useState(currentRole === 'ADMIN' ? currentToken : '');

  useEffect(() => {
    if (authSession?.token) {
      localStorage.setItem('qflow_auth_session', JSON.stringify(authSession));
      const role = authSession.user.role;
      if (role === 'PATIENT') setPatientToken(authSession.token);
      if (role === 'STAFF') setStaffToken(authSession.token);
      if (role === 'DOCTOR') setDoctorToken(authSession.token);
      if (role === 'ADMIN') {
        setAdminToken(authSession.token);
        setStaffToken(authSession.token);
      }
    } else {
      localStorage.removeItem('qflow_auth_session');
    }
  }, [authSession]);

  // Tab View Routing
  const [viewTab, setViewTab] = useState(() => {
    if (currentRole === 'STAFF') return 'reception';
    if (currentRole === 'DOCTOR') return 'doctor_cockpit';
    if (currentRole === 'ADMIN') return 'reception';
    return 'discover';
  });

  // Tab visibility tracker for polling control (Phase 13)
  const [isTabVisible, setIsTabVisible] = useState(true);
  useEffect(() => {
    const handleVisChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () => document.removeEventListener('visibilitychange', handleVisChange);
  }, []);

  // ----------------------------------------------------
  // Interactive Notification Center State (Phase 13)
  // ----------------------------------------------------
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!patientToken) return;
    const res = await fetchPatientNotifications(patientToken);
    if (res.ok && res.data) {
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    }
  }, [patientToken]);

  useEffect(() => {
    if (patientToken && isTabVisible) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [patientToken, isTabVisible, loadNotifications]);

  const handleMarkAsRead = async (notifId) => {
    if (!patientToken) return;
    const res = await markNotificationAsRead(notifId, patientToken);
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  // ----------------------------------------------------
  // Doctor Examination Cockpit State (Phase 13)
  // ----------------------------------------------------
  const [doctorQueueData, setDoctorQueueData] = useState([]);
  const [doctorActivePatient, setDoctorActivePatient] = useState(null);
  const [doctorLiveStatus, setDoctorLiveStatus] = useState('AVAILABLE');
  const [doctorIntel, setDoctorIntel] = useState(null);
  const [doctorOpLoading, setDoctorOpLoading] = useState(false);
  const [doctorMessage, setDoctorMessage] = useState(null);

  // Doctor Cockpit Sub-Tab Navigation ('queue' | 'appointments' | 'schedule')
  const [doctorSubTab, setDoctorSubTab] = useState('queue');

  // Doctor Appointments State
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [doctorApptLoading, setDoctorApptLoading] = useState(false);
  const [doctorApptError, setDoctorApptError] = useState(null);
  const [doctorApptScope, setDoctorApptScope] = useState('today'); // 'today' | 'upcoming' | 'past'
  const [doctorApptSearch, setDoctorApptSearch] = useState('');
  const [doctorApptDate, setDoctorApptDate] = useState('');
  const [doctorCancelModal, setDoctorCancelModal] = useState({
    isOpen: false,
    appointment: null,
    reason: '',
    loading: false,
    error: null,
  });

  // Doctor Schedule Self-Service State
  const [doctorScheduleWeeklyHours, setDoctorScheduleWeeklyHours] = useState(() =>
    ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => ({
      dayOfWeek: day,
      isWorkingDay: false,
      shifts: [],
      breaks: [],
    }))
  );
  const [doctorScheduleDuration, setDoctorScheduleDuration] = useState(15);
  const [doctorScheduleLoading, setDoctorScheduleLoading] = useState(false);
  const [doctorScheduleSaving, setDoctorScheduleSaving] = useState(false);
  const [doctorScheduleMessage, setDoctorScheduleMessage] = useState(null);
  const [doctorProfileData, setDoctorProfileData] = useState(null);

  const getAgeFromDob = (dobString) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const loadDoctorAppointments = useCallback(async (scopeOverride, dateOverride) => {
    if (!doctorToken) return;
    setDoctorApptLoading(true);
    setDoctorApptError(null);
    const scopeToUse = scopeOverride !== undefined ? scopeOverride : doctorApptScope;
    const dateToUse = dateOverride !== undefined ? dateOverride : doctorApptDate;

    const params = {};
    if (dateToUse) {
      params.date = dateToUse;
    } else if (scopeToUse) {
      params.scope = scopeToUse;
    }

    const res = await fetchDoctorOwnAppointments(doctorToken, params);
    if (res.ok && res.data?.appointments) {
      setDoctorAppointments(res.data.appointments);
    } else {
      setDoctorApptError(res.data?.message || res.error || 'Failed to load appointments');
    }
    setDoctorApptLoading(false);
  }, [doctorToken, doctorApptScope, doctorApptDate]);

  const loadDoctorSelfSchedule = useCallback(async () => {
    if (!doctorToken) return;
    setDoctorScheduleLoading(true);
    setDoctorScheduleMessage(null);
    const res = await fetchDoctorOwnSchedule(doctorToken);
    if (res.ok && res.data) {
      if (res.data.doctor) {
        setDoctorProfileData(res.data.doctor);
        if (res.data.doctor.averageConsultationDurationMinutes) {
          setDoctorScheduleDuration(res.data.doctor.averageConsultationDurationMinutes);
        }
      }
      const existingWeekly = res.data.schedule?.weeklyHours || [];
      const hoursMap = new Map();
      existingWeekly.forEach((d) => hoursMap.set(d.dayOfWeek, d));

      const merged = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((dayName) => {
        const existing = hoursMap.get(dayName);
        if (existing) {
          return {
            dayOfWeek: dayName,
            isWorkingDay: Boolean(existing.isWorkingDay),
            shifts: Array.isArray(existing.shifts)
              ? existing.shifts.map((s) => ({
                  startTime: s.startTime || '09:00',
                  endTime: s.endTime || '13:00',
                }))
              : [],
            breaks: Array.isArray(existing.breaks)
              ? existing.breaks.map((b) => ({
                  startTime: b.startTime || '13:00',
                  endTime: b.endTime || '14:00',
                  label: b.label || 'Break',
                }))
              : [],
          };
        }
        return {
          dayOfWeek: dayName,
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        };
      });
      setDoctorScheduleWeeklyHours(merged);
    } else {
      setDoctorScheduleMessage(`⚠️ ${res.data?.message || res.error || 'Failed to load schedule'}`);
    }
    setDoctorScheduleLoading(false);
  }, [doctorToken]);

  const handleDoctorScheduleSave = async () => {
    if (!doctorToken) return;
    setDoctorScheduleSaving(true);
    setDoctorScheduleMessage(null);

    const dur = parseInt(doctorScheduleDuration, 10);
    if (isNaN(dur) || dur < 1 || dur > 240) {
      setDoctorScheduleMessage('⚠️ Consultation duration must be an integer between 1 and 240 minutes');
      setDoctorScheduleSaving(false);
      return;
    }

    const payload = {
      weeklyHours: doctorScheduleWeeklyHours,
      averageConsultationDurationMinutes: dur,
    };

    const res = await updateDoctorScheduleSelf(payload, doctorToken);
    if (res.ok) {
      setDoctorScheduleMessage('✅ Schedule and consultation duration updated successfully!');
      if (res.data?.doctor?.averageConsultationDurationMinutes) {
        setDoctorScheduleDuration(res.data.doctor.averageConsultationDurationMinutes);
      }
    } else {
      setDoctorScheduleMessage(`⚠️ Error: ${res.data?.message || res.error || 'Failed to update schedule'}`);
    }
    setDoctorScheduleSaving(false);
  };

  const handleDoctorToggleWorkingDay = (dayIndex) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const nextVal = !target.isWorkingDay;
      target.isWorkingDay = nextVal;
      if (nextVal && (!target.shifts || target.shifts.length === 0)) {
        target.shifts = [{ startTime: '09:00', endTime: '13:00' }];
      }
      if (!nextVal) {
        target.shifts = [];
        target.breaks = [];
      }
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorAddShift = (dayIndex) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const currentShifts = Array.isArray(target.shifts) ? [...target.shifts] : [];
      let nextStart = '14:00';
      let nextEnd = '18:00';
      if (currentShifts.length > 0) {
        const lastShift = currentShifts[currentShifts.length - 1];
        if (lastShift.endTime < '17:00') {
          nextStart = '17:00';
          nextEnd = '20:00';
        } else {
          nextStart = '18:00';
          nextEnd = '21:00';
        }
      }
      currentShifts.push({ startTime: nextStart, endTime: nextEnd });
      target.shifts = currentShifts;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorRemoveShift = (dayIndex, shiftIndex) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      target.shifts = (target.shifts || []).filter((_, idx) => idx !== shiftIndex);
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorShiftChange = (dayIndex, shiftIndex, field, value) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const shifts = [...(target.shifts || [])];
      shifts[shiftIndex] = { ...shifts[shiftIndex], [field]: value };
      target.shifts = shifts;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorAddBreak = (dayIndex) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const currentBreaks = Array.isArray(target.breaks) ? [...target.breaks] : [];
      currentBreaks.push({ startTime: '13:00', endTime: '14:00', label: 'Lunch' });
      target.breaks = currentBreaks;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorRemoveBreak = (dayIndex, breakIndex) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      target.breaks = (target.breaks || []).filter((_, idx) => idx !== breakIndex);
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorBreakChange = (dayIndex, breakIndex, field, value) => {
    setDoctorScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const breaks = [...(target.breaks || [])];
      breaks[breakIndex] = { ...breaks[breakIndex], [field]: value };
      target.breaks = breaks;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleDoctorApplyMonToFriPreset = () => {
    setDoctorScheduleWeeklyHours((prev) =>
      prev.map((day) => {
        if (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(day.dayOfWeek)) {
          return {
            dayOfWeek: day.dayOfWeek,
            isWorkingDay: true,
            shifts: [
              { startTime: '09:00', endTime: '13:00' },
              { startTime: '16:00', endTime: '20:00' },
            ],
            breaks: [],
          };
        }
        return {
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        };
      })
    );
  };

  const handleDoctorApplySingleShiftPreset = () => {
    setDoctorScheduleWeeklyHours((prev) =>
      prev.map((day) => {
        if (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].includes(day.dayOfWeek)) {
          return {
            dayOfWeek: day.dayOfWeek,
            isWorkingDay: true,
            shifts: [{ startTime: '09:00', endTime: '17:00' }],
            breaks: [{ startTime: '13:00', endTime: '14:00', label: 'Lunch Break' }],
          };
        }
        return {
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        };
      })
    );
  };

  const handleDoctorMarkAllOffDuty = () => {
    setDoctorScheduleWeeklyHours((prev) =>
      prev.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isWorkingDay: false,
        shifts: [],
        breaks: [],
      }))
    );
  };

  const handleDoctorCancelAppointment = async () => {
    if (!doctorToken || !doctorCancelModal.appointment) return;
    setDoctorCancelModal((prev) => ({ ...prev, loading: true, error: null }));
    const res = await cancelAppointment(
      doctorCancelModal.appointment._id,
      doctorToken,
      doctorCancelModal.reason.trim() || 'Cancelled by doctor'
    );
    if (res.ok) {
      setDoctorCancelModal({ isOpen: false, appointment: null, reason: '', loading: false, error: null });
      setDoctorMessage('✅ Appointment successfully cancelled');
      loadDoctorAppointments();
    } else {
      setDoctorCancelModal((prev) => ({
        ...prev,
        loading: false,
        error: res.data?.message || res.error || 'Failed to cancel appointment',
      }));
    }
  };

  const loadDoctorCockpit = useCallback(async () => {
    if (!doctorToken) return;
    // Fetch doctor intelligence and status
    const intelRes = await fetchDoctorOwnIntelligence(doctorToken);
    if (intelRes.ok && intelRes.data?.data) {
      setDoctorIntel(intelRes.data.data);
    }

    // Fetch today's queue for doctor's clinic
    const todayRes = await fetchTodayStaffQueue(doctorToken);
    const queueList = todayRes.data?.queue || todayRes.data?.queueEntries;
    if (todayRes.ok && queueList) {
      const allQueue = queueList;
      // Filter for this doctor's patients
      const myDoctorId = intelRes.data?.data?.doctorId;
      const myQueue = myDoctorId
        ? allQueue.filter((q) => (q.doctorId?._id || q.doctorId)?.toString() === myDoctorId?.toString())
        : allQueue;

      const active = myQueue.find((q) => q.status === 'IN_CONSULTATION' || q.status === 'CALLED');
      setDoctorActivePatient(active || null);
      setDoctorQueueData(myQueue.filter((q) => q.status === 'WAITING'));
    }
  }, [doctorToken]);

  useEffect(() => {
    if (viewTab === 'doctor_cockpit' && doctorToken && isTabVisible) {
      if (doctorSubTab === 'queue') {
        loadDoctorCockpit();
        const interval = setInterval(loadDoctorCockpit, 10000);
        return () => clearInterval(interval);
      } else if (doctorSubTab === 'appointments') {
        loadDoctorAppointments();
      } else if (doctorSubTab === 'schedule') {
        loadDoctorSelfSchedule();
      }
    }
  }, [viewTab, doctorSubTab, doctorToken, isTabVisible, loadDoctorCockpit, loadDoctorAppointments, loadDoctorSelfSchedule]);

  const handleDoctorStatusUpdate = async (status) => {
    if (!doctorToken) return;
    setDoctorOpLoading(true);
    setDoctorMessage(null);
    const res = await updateDoctorSelfStatus({ operationalStatus: status }, doctorToken);
    if (res.ok) {
      setDoctorLiveStatus(status);
      setDoctorMessage(`✓ Operational status updated to ${status}`);
    } else {
      setDoctorMessage(`Error: ${res.data?.message || res.error}`);
    }
    setDoctorOpLoading(false);
  };

  const handleDoctorCallNext = async () => {
    if (!doctorToken) return;
    setDoctorOpLoading(true);
    setDoctorMessage(null);
    const docId = doctorIntel?.doctorId;
    const res = await callNextPatient(docId, doctorToken);
    if (res.ok) {
      setDoctorMessage(`✓ Called Patient Token #${res.data.queueEntry?.tokenNumber}`);
      loadDoctorCockpit();
    } else {
      setDoctorMessage(`Error: ${res.data?.message || res.error}`);
    }
    setDoctorOpLoading(false);
  };

  const handleDoctorStartConsultation = async () => {
    if (!doctorToken || !doctorActivePatient) return;
    setDoctorOpLoading(true);
    setDoctorMessage(null);
    const res = await startConsultation(doctorActivePatient._id, doctorToken);
    if (res.ok) {
      setDoctorMessage('✓ Consultation started successfully');
      loadDoctorCockpit();
    } else {
      setDoctorMessage(`Error: ${res.data?.message || res.error}`);
    }
    setDoctorOpLoading(false);
  };

  const handleDoctorCompleteConsultation = async () => {
    if (!doctorToken || !doctorActivePatient) return;
    setDoctorOpLoading(true);
    setDoctorMessage(null);
    const res = await completeConsultation(doctorActivePatient._id, doctorToken);
    if (res.ok) {
      setDoctorMessage('✓ Consultation completed successfully');
      loadDoctorCockpit();
    } else {
      setDoctorMessage(`Error: ${res.data?.message || res.error}`);
    }
    setDoctorOpLoading(false);
  };

  // ----------------------------------------------------
  // Discovery, Booking, and Standard State
  // ----------------------------------------------------
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [sort, setSort] = useState('rating');
  const [minRating, setMinRating] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [doctorGender, setDoctorGender] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);

  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('Location: Not requested');
  const [locLoading, setLocLoading] = useState(false);

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [profileData, setProfileData] = useState(null);

  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateIST());
  const [availability, setAvailability] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [myAppointments, setMyAppointments] = useState([]);
  const [cancellationLoadingId, setCancellationLoadingId] = useState(null);
  const [appointmentMessage, setAppointmentMessage] = useState(null);

  // Reception State
  const [receptionSubTab, setReceptionSubTab] = useState('queue'); // 'queue' | 'checkin' | 'walkin'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStaffPatient, setSelectedStaffPatient] = useState(null);
  const [isCreatingNewPatient, setIsCreatingNewPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ fullName: '', phone: '', gender: 'MALE', dateOfBirth: '', address: '' });
  const [newPatientCreating, setNewPatientCreating] = useState(false);
  const [newPatientError, setNewPatientError] = useState(null);
  const [receptionDoctorId, setReceptionDoctorId] = useState('');
  const [allocatedTokenCard, setAllocatedTokenCard] = useState(null);
  const [waitingEntries, setWaitingEntries] = useState([]);
  const [activeEntries, setActiveEntries] = useState([]);
  const [skippedEntries, setSkippedEntries] = useState([]);
  const [terminalEntries, setTerminalEntries] = useState([]);
  const [doctorQueueStatus, setDoctorQueueStatus] = useState({ isQueuePaused: false, queuePausedAt: null, queuePauseReason: null });
  const [opLoading, setOpLoading] = useState(false);
  const [receptionMessage, setReceptionMessage] = useState(null);

  // Staff Clinic Appointments & Check-In State
  const [staffAppointments, setStaffAppointments] = useState([]);
  const [staffApptLoading, setStaffApptLoading] = useState(false);
  const [staffApptError, setStaffApptError] = useState(null);
  const [staffApptDate, setStaffApptDate] = useState(() => getTodayDateIST());
  const [staffApptStatus, setStaffApptStatus] = useState('BOOKED'); // 'ALL' | 'BOOKED'
  const [staffApptSearch, setStaffApptSearch] = useState('');
  const [checkInLoadingId, setCheckInLoadingId] = useState(null);

  // Live Queue & Public Display State
  const [liveQueueData, setLiveQueueData] = useState(null);
  const [publicDisplayData, setPublicDisplayData] = useState(null);
  const [publicClinicId, setPublicClinicId] = useState('');

  // Rating Modal State
  const [ratingModalEntry, setRatingModalEntry] = useState(null);
  const [patientScore, setPatientScore] = useState(5);
  const [patientReview, setPatientReview] = useState('');

  // Billing State
  const [patientInvoices, setPatientInvoices] = useState([]);
  const [staffBillingData, setStaffBillingData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Load Specialties & Doctors
  useEffect(() => {
    fetchSpecialties().then((res) => {
      if (res.ok && res.data.specialties) {
        setSpecialties(res.data.specialties);
      }
    });
  }, []);

  const loadDiscovery = async () => {
    setLoading(true);
    setError(null);
    const params = {
      specialtyId: selectedSpecialty,
      sort,
      minRating,
      minExperience,
      maxFee,
      doctorGender,
      radiusKm,
    };
    if (coords) {
      params.latitude = coords.latitude;
      params.longitude = coords.longitude;
    }
    const res = await discoverDoctors(params);
    if (res.ok && res.data.doctors) {
      setDoctors(res.data.doctors);
      if (res.data.doctors.length > 0 && !receptionDoctorId) {
        setReceptionDoctorId(res.data.doctors[0]._id);
      }
    } else {
      setError(res.data?.message || res.error || 'Failed to discover doctors');
    }
    setLoading(false);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Geolocation is not supported by your browser');
      return;
    }

    setLocLoading(true);
    setLocStatus('Detecting your location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        setLocStatus(`Location acquired (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`);
        setLocLoading(false);
      },
      (error) => {
        setLocLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocStatus('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocStatus('Location information unavailable');
            break;
          case error.TIMEOUT:
            setLocStatus('Location request timed out');
            break;
          default:
            setLocStatus(`Location error: ${error.message || 'Unable to retrieve location'}`);
            break;
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    if (viewTab === 'discover' || viewTab === 'reception') {
      loadDiscovery();
    }
  }, [selectedSpecialty, sort, minRating, minExperience, maxFee, doctorGender, coords, radiusKm, viewTab]);

  useEffect(() => {
    if (bookingDoctor && selectedDate) {
      const today = getTodayDateIST();
      if (selectedDate < today) {
        setAvailability({
          success: false,
          availableSlots: [],
          message: 'Selected date is in the past. Please select today or a future date.',
          isPastDate: true,
        });
        setLoadingAvail(false);
        return;
      }

      setLoadingAvail(true);
      setSelectedSlot(null);
      fetchDoctorAvailability(bookingDoctor._id, selectedDate).then((res) => {
        if (res.ok && res.data) {
          setAvailability(res.data);
        } else {
          setAvailability({
            success: false,
            availableSlots: [],
            message:
              res.data?.message ||
              res.error ||
              'Unable to load appointment availability. Please check your connection and try again.',
            isError: true,
            status: res.status,
          });
        }
        setLoadingAvail(false);
      });
    }
  }, [bookingDoctor, selectedDate]);

  const handleOpenProfile = async (docId) => {
    const res = await fetchDoctorProfile(docId);
    if (res.ok && res.data.doctor) {
      setProfileData(res.data.doctor);
      setSelectedDoctor(res.data.doctor);
    }
  };

  const handleProceedToAppointment = (doctor) => {
    setSelectedDoctor(null);
    setBookingDoctor(doctor);
    const today = getTodayDateIST();
    setSelectedDate((prev) => (!prev || prev < today ? today : prev));
    setBookingSuccess(null);
    setBookingError(null);
  };

  const handleConfirmBooking = async () => {
    if (!patientToken) {
      setShowAuthModal(true);
      return;
    }
    if (!bookingDoctor || !selectedSlot || !selectedDate || bookingLoading) return;
    setBookingLoading(true);
    setBookingError(null);
    const bookingBody = {
      doctorId: bookingDoctor._id,
      appointmentDate: selectedDate,
      timeSlot: selectedSlot,
    };
    const res = await createAppointment(bookingBody, patientToken);
    setBookingLoading(false);
    if (res.ok && res.data?.success) {
      const confirmedAppt = res.data.appointment || {
        _id: res.data.appointment?._id,
        doctorName: bookingDoctor.fullName,
        clinicName: bookingDoctor.clinicId?.name,
        appointmentDate: selectedDate,
        timeSlot: selectedSlot,
        status: 'BOOKED',
      };
      if (!confirmedAppt.doctorName) confirmedAppt.doctorName = bookingDoctor.fullName;
      if (!confirmedAppt.clinicName) confirmedAppt.clinicName = bookingDoctor.clinicId?.name;

      setBookingSuccess(confirmedAppt);
      setBookingDoctor(null);
      setSelectedSlot(null);
      loadMyAppointments();
    } else {
      const errMsg = res.data?.message || res.error || 'Booking failed';
      setBookingError(errMsg);
      // If slot was taken concurrently (409 Conflict), immediately refresh availability
      if (res.status === 409 && bookingDoctor && selectedDate) {
        fetchDoctorAvailability(bookingDoctor._id, selectedDate).then((availRes) => {
          if (availRes.ok && availRes.data) {
            setAvailability(availRes.data);
          }
        });
      }
    }
  };

  const loadMyAppointments = async () => {
    if (!patientToken) return;
    const res = await fetchMyAppointments(patientToken);
    if (res.ok && res.data.appointments) {
      setMyAppointments(res.data.appointments);
    }
  };

  useEffect(() => {
    if (viewTab === 'my_appointments' && patientToken) {
      loadMyAppointments();
    }
  }, [viewTab, patientToken]);

  const handleCancelAppointment = async (apptId) => {
    if (!patientToken || cancellationLoadingId) return;
    setCancellationLoadingId(apptId);
    setAppointmentMessage(null);
    const res = await cancelAppointment(apptId, patientToken, 'Cancelled by patient from dashboard');
    setCancellationLoadingId(null);
    if (res.ok && res.data?.success) {
      setAppointmentMessage({
        type: 'success',
        text: '✓ Appointment cancelled successfully. Your time slot has been reopened for booking.',
      });
      loadMyAppointments();
    } else {
      setAppointmentMessage({
        type: 'error',
        text: res.data?.message || res.error || 'Failed to cancel appointment. Please try again.',
      });
    }
  };

  // Phase 14 Patient Self-Check-In
  const [selfCheckInMessage, setSelfCheckInMessage] = useState(null);
  const [selfCheckInLoading, setSelfCheckInLoading] = useState(false);

  const handleSelfCheckIn = async (apptId) => {
    if (!patientToken) return;
    setSelfCheckInLoading(true);
    setSelfCheckInMessage(null);
    const res = await selfCheckInAppointment(apptId, patientToken);
    if (res.ok && res.data?.success) {
      setSelfCheckInMessage(`✓ Self Check-In Successful! Token #${res.data.queueEntry?.tokenNumber} allocated.`);
      loadMyAppointments();
    } else {
      setSelfCheckInMessage(`Check-In Failed: ${res.data?.message || res.error || 'Server error'}`);
    }
    setSelfCheckInLoading(false);
  };

  // Staff Patient Search
  const handleStaffPatientSearch = async () => {
    if (!staffToken || !searchQuery) return;
    setReceptionMessage(null);
    const isPhone = /^\d+$/.test(searchQuery);
    const searchBody = isPhone ? { phone: searchQuery } : { name: searchQuery };
    const res = await searchStaffPatients(searchBody, staffToken);
    if (res.ok && res.data.patients) {
      setSearchResults(res.data.patients);
    }
  };

  const handleSelectStaffPatient = (p) => {
    setSelectedStaffPatient(p);
    setSearchResults([]);
  };

  const handleCreateWalkInPatient = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!staffToken || newPatientCreating) return;
    if (!newPatientForm.fullName.trim()) {
      setNewPatientError('Full name is required');
      return;
    }
    if (!/^\d{10}$/.test(newPatientForm.phone.trim())) {
      setNewPatientError('Valid 10-digit phone number is required');
      return;
    }
    if (!newPatientForm.dateOfBirth) {
      setNewPatientError('Date of birth is required');
      return;
    }
    setNewPatientCreating(true);
    setNewPatientError(null);
    const res = await createWalkInPatient({
      fullName: newPatientForm.fullName.trim(),
      phone: newPatientForm.phone.trim(),
      gender: newPatientForm.gender,
      dateOfBirth: newPatientForm.dateOfBirth,
      address: newPatientForm.address ? { street: newPatientForm.address } : undefined,
    }, staffToken);

    if (res.ok && res.data?.patient) {
      setSelectedStaffPatient(res.data.patient);
      setIsCreatingNewPatient(false);
      setNewPatientForm({ fullName: '', phone: '', gender: 'MALE', dateOfBirth: '', address: '' });
      setReceptionMessage(`✓ Created new walk-in patient profile: ${res.data.patient.fullName}`);
    } else {
      setNewPatientError(res.data?.message || res.error || 'Failed to create patient profile');
    }
    setNewPatientCreating(false);
  };

  const handleRegisterWalkInQueue = async () => {
    if (!staffToken || !selectedStaffPatient || !receptionDoctorId) return;
    const body = {
      patientId: selectedStaffPatient._id,
      doctorId: receptionDoctorId,
      priority: 'NORMAL',
    };
    const res = await registerWalkIn(body, staffToken);
    if (res.ok && res.data.queueEntry) {
      setAllocatedTokenCard(res.data.queueEntry);
      setSelectedStaffPatient(null);
      const walkInDocId = (res.data.queueEntry.doctorId?._id || res.data.queueEntry.doctorId)?.toString();
      if (walkInDocId) {
        setReceptionDoctorId(walkInDocId);
        loadTodayStaffQueue(walkInDocId);
      } else {
        loadTodayStaffQueue();
      }
    } else {
      setReceptionMessage(`Error: ${res.data?.message || res.error}`);
    }
  };

  const loadTodayStaffQueue = useCallback(async (selectedDocId) => {
    if (!staffToken) return;
    const docId = typeof selectedDocId === 'string' && selectedDocId.trim() !== '' ? selectedDocId : receptionDoctorId;
    const params = {};
    if (docId) params.doctorId = docId;
    const res = await fetchTodayStaffQueue(staffToken, params);
    if (res.ok && res.data) {
      const queue = res.data.queue || res.data.queueEntries || [];
      const waiting = res.data.waitingEntries || queue.filter((q) => q.status === 'WAITING');
      const active = res.data.activeEntries || queue.filter((q) => q.status === 'CALLED' || q.status === 'IN_CONSULTATION');
      const skipped = res.data.skippedEntries || queue.filter((q) => q.status === 'SKIPPED');
      const terminal = res.data.terminalEntries || queue.filter((q) => ['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(q.status));
      setWaitingEntries(waiting);
      setActiveEntries(active);
      setSkippedEntries(skipped);
      setTerminalEntries(terminal);
      const docStatus = res.data.doctorQueueStatus || res.data.doctorStatus;
      if (docStatus) {
        setDoctorQueueStatus(docStatus);
      }
    }
  }, [staffToken, receptionDoctorId]);

  const loadStaffAppointments = useCallback(async (dateOverride, statusOverride) => {
    if (!staffToken) return;
    setStaffApptLoading(true);
    setStaffApptError(null);
    const dateToUse = dateOverride !== undefined ? dateOverride : staffApptDate;
    const statusToUse = statusOverride !== undefined ? statusOverride : staffApptStatus;
    const params = {};
    if (dateToUse) params.date = dateToUse;
    if (statusToUse && statusToUse !== 'ALL') params.status = statusToUse;

    const res = await fetchStaffAppointments(staffToken, params);
    if (res.ok && res.data?.appointments) {
      setStaffAppointments(res.data.appointments);
    } else {
      setStaffApptError(res.data?.message || res.error || 'Failed to load clinic appointments');
    }
    setStaffApptLoading(false);
  }, [staffToken, staffApptDate, staffApptStatus]);

  const handleStaffCheckIn = async (appointmentId) => {
    if (!staffToken || checkInLoadingId) return;
    setCheckInLoadingId(appointmentId);
    setReceptionMessage(null);
    const res = await checkInAppointment(appointmentId, staffToken);
    if (res.ok && res.data) {
      const qEntry = res.data.queueEntry;
      setAllocatedTokenCard(qEntry);
      setReceptionMessage(`✅ Patient checked in successfully! Allocated Queue Token #${qEntry?.tokenNumber}`);
      loadStaffAppointments();
      const targetDocId = res.data.appointment?.doctorId || qEntry?.doctorId;
      if (targetDocId) {
        const docIdStr = (targetDocId._id || targetDocId).toString();
        setReceptionDoctorId(docIdStr);
        loadTodayStaffQueue(docIdStr);
      } else {
        loadTodayStaffQueue();
      }
    } else {
      setReceptionMessage(`⚠️ Check-In Failed: ${res.data?.message || res.error || 'Check-in period not open or expired'}`);
    }
    setCheckInLoadingId(null);
  };

  const handleStaffRejoinSkipped = async (queueEntryId) => {
    if (!staffToken) return;
    setOpLoading(true);
    setReceptionMessage(null);
    const res = await rejoinPatient(queueEntryId, staffToken);
    if (res.ok && res.data?.queueEntry) {
      setReceptionMessage(`✅ Patient rejoined queue with new Token #${res.data.queueEntry.tokenNumber}`);
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`⚠️ Rejoin Failed: ${res.data?.message || res.error}`);
    }
    setOpLoading(false);
  };

  const handleStaffCancelQueueEntry = async (id) => {
    const reason = window.prompt('Enter operational reason for cancelling queue entry:');
    if (reason === null) return;
    if (!staffToken) return;
    setOpLoading(true);
    setReceptionMessage(null);
    const res = await cancelQueueEntry(id, reason.trim() || 'Cancelled at reception desk', staffToken);
    if (res.ok) {
      setReceptionMessage('✅ Queue entry cancelled successfully');
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`⚠️ Cancellation Failed: ${res.data?.message || res.error}`);
    }
    setOpLoading(false);
  };

  useEffect(() => {
    if (viewTab === 'reception' && staffToken && isTabVisible) {
      if (receptionSubTab === 'queue' || receptionSubTab === 'walkin') {
        loadTodayStaffQueue();
        const interval = setInterval(loadTodayStaffQueue, 10000);
        return () => clearInterval(interval);
      } else if (receptionSubTab === 'checkin') {
        loadStaffAppointments();
      }
    }
  }, [viewTab, receptionSubTab, staffToken, isTabVisible, loadTodayStaffQueue, loadStaffAppointments]);

  // Reception Queue Action Handlers
  const handleCallNext = async () => {
    if (!staffToken || !receptionDoctorId) return;
    setOpLoading(true);
    const res = await callNextPatient(receptionDoctorId, staffToken);
    if (res.ok) {
      setReceptionMessage(`✓ Successfully called Token #${res.data.queueEntry?.tokenNumber}`);
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`Error: ${res.data?.message || res.error}`);
    }
    setOpLoading(false);
  };

  const handleStartConsultation = async (id) => {
    if (!staffToken) return;
    const res = await startConsultation(id, staffToken);
    if (res.ok) {
      setReceptionMessage('✓ Consultation started');
      loadTodayStaffQueue();
    }
  };

  const handleCompleteConsultation = async (id) => {
    if (!staffToken) return;
    const res = await completeConsultation(id, staffToken);
    if (res.ok) {
      setReceptionMessage('✓ Consultation completed');
      loadTodayStaffQueue();
    }
  };

  const handleSkip = async (id) => {
    if (!staffToken) return;
    const res = await skipPatient(id, 'Patient not present when called', staffToken);
    if (res.ok) {
      setReceptionMessage('✓ Patient skipped');
      loadTodayStaffQueue();
    }
  };

  const handleNoShow = async (id) => {
    if (!staffToken) return;
    const res = await markNoShow(id, 'No-show after multiple calls', staffToken);
    if (res.ok) {
      setReceptionMessage('✓ Patient marked NO_SHOW');
      loadTodayStaffQueue();
    }
  };

  const handleRejoin = async (id) => {
    if (!staffToken) return;
    const res = await rejoinPatient(id, staffToken);
    if (res.ok) {
      setReceptionMessage(`✓ Patient rejoined with new Token #${res.data.queueEntry?.tokenNumber}`);
      loadTodayStaffQueue();
    }
  };

  const handlePauseQueue = async () => {
    if (!staffToken || !receptionDoctorId) return;
    const res = await pauseQueue(receptionDoctorId, 'Doctor on lunch break', staffToken);
    if (res.ok) {
      setReceptionMessage('✓ Doctor queue paused');
      loadTodayStaffQueue();
    }
  };

  const handleResumeQueue = async () => {
    if (!staffToken || !receptionDoctorId) return;
    const res = await resumeQueue(receptionDoctorId, staffToken);
    if (res.ok) {
      setReceptionMessage('✓ Doctor queue resumed');
      loadTodayStaffQueue();
    }
  };

  // ----------------------------------------------------
  // Phase 14: Triage Priority Escalation
  // ----------------------------------------------------
  const [triageModalEntry, setTriageModalEntry] = useState(null);
  const [triagePriority, setTriagePriority] = useState('PRIORITY');
  const [triageReason, setTriageReason] = useState('');
  const [triageOpLoading, setTriageOpLoading] = useState(false);

  const handleOpenTriage = (entry) => {
    setTriageModalEntry(entry);
    setTriagePriority(entry.priority === 'NORMAL' ? 'PRIORITY' : entry.priority || 'PRIORITY');
    setTriageReason('');
  };

  const handleSubmitTriage = async () => {
    if (!staffToken || !triageModalEntry) return;
    setTriageOpLoading(true);
    const res = await triageQueueEntry(
      triageModalEntry._id,
      { priority: triagePriority, reason: triageReason },
      staffToken
    );
    if (res.ok) {
      setReceptionMessage(`✓ Priority escalated to ${triagePriority} for Token #${triageModalEntry.tokenNumber}`);
      setTriageModalEntry(null);
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`Triage Failed: ${res.data?.message || res.error || 'Operation failed'}`);
    }
    setTriageOpLoading(false);
  };

  // ----------------------------------------------------
  // Phase 14: Doctor Queue Transfer
  // ----------------------------------------------------
  const [transferModalEntry, setTransferModalEntry] = useState(null);
  const [transferTargetDoctorId, setTransferTargetDoctorId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferOpLoading, setTransferOpLoading] = useState(false);

  const handleOpenTransfer = (entry) => {
    setTransferModalEntry(entry);
    setTransferTargetDoctorId('');
    setTransferReason('');
  };

  const handleSubmitTransfer = async () => {
    if (!staffToken || !transferModalEntry || !transferTargetDoctorId) return;
    setTransferOpLoading(true);
    const res = await transferQueueDoctor(
      transferModalEntry._id,
      { targetDoctorId: transferTargetDoctorId, reason: transferReason },
      staffToken
    );
    if (res.ok) {
      setReceptionMessage(`✓ Transferred Token #${transferModalEntry.tokenNumber} to Dr. ${res.data?.targetDoctor?.fullName || 'Doctor'} (New Token #${res.data?.newTokenNumber})`);
      setTransferModalEntry(null);
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`Transfer Failed: ${res.data?.message || res.error || 'Operation failed'}`);
    }
    setTransferOpLoading(false);
  };

  // ----------------------------------------------------
  // Phase 14: Clinic Day-End Settlement & Reconciliation
  // ----------------------------------------------------
  const [settlementPreview, setSettlementPreview] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementMessage, setSettlementMessage] = useState(null);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementForce, setSettlementForce] = useState(false);
  const [settlementHistory, setSettlementHistory] = useState([]);

  const loadSettlementPreview = useCallback(async () => {
    const token = staffToken || adminToken;
    if (!token) return;
    setSettlementLoading(true);
    const res = await fetchReconciliationPreview(null, token);
    if (res.ok && res.data) {
      setSettlementPreview(res.data);
    } else {
      setSettlementMessage(`Failed to load settlement preview: ${res.data?.message || res.error}`);
    }
    setSettlementLoading(false);
  }, [staffToken, adminToken]);

  const loadSettlementHistory = async () => {
    const token = staffToken || adminToken;
    if (!token) return;
    const res = await fetchDailySettlements({}, token);
    if (res.ok && res.data?.settlements) {
      setSettlementHistory(res.data.settlements);
    }
  };

  const handleCloseClinicDay = async () => {
    const token = staffToken || adminToken;
    if (!token) return;
    setSettlementLoading(true);
    setSettlementMessage(null);
    const res = await closeClinicDay(
      { notes: settlementNotes, force: settlementForce },
      token
    );
    if (res.ok && res.data?.success) {
      setSettlementMessage(`✓ Day Finalized! Expired ${res.data.expiredCount || 0} unserved entries, generated ${res.data.autoGeneratedInvoicesCount || 0} invoices.`);
      loadSettlementPreview();
      loadSettlementHistory();
      loadTodayStaffQueue();
    } else {
      setSettlementMessage(`Settlement Failed: ${res.data?.message || res.error || 'Server error'}`);
    }
    setSettlementLoading(false);
  };

  useEffect(() => {
    if (viewTab === 'settlement' && (staffToken || adminToken)) {
      loadSettlementPreview();
    }
  }, [viewTab, staffToken, adminToken, loadSettlementPreview]);

  // ----------------------------------------------------
  // Phase 15: Export & Governance State & Handlers
  // ----------------------------------------------------
  const [exportLoadingId, setExportLoadingId] = useState(null);
  const [invoicesExportLoading, setInvoicesExportLoading] = useState(false);

  const handleExportSettlementCSV = async (settlementId) => {
    const token = staffToken || adminToken;
    if (!token) return;
    setExportLoadingId(settlementId);
    const res = await downloadSettlementCSV(settlementId, token);
    if (!res.ok) {
      alert(`Export failed: ${res.error || 'Failed to download settlement CSV'}`);
    }
    setExportLoadingId(null);
  };

  const handleExportInvoicesCSV = async (clinicId, date) => {
    const token = staffToken || adminToken;
    if (!token) return;
    setInvoicesExportLoading(true);
    const res = await downloadInvoicesCSV(clinicId, date, token);
    if (!res.ok) {
      alert(`Invoice export failed: ${res.error || 'Failed to download invoices CSV'}`);
    }
    setInvoicesExportLoading(false);
  };

  // Admin Governance State
  const [adminSubTab, setAdminSubTab] = useState('policy'); // 'policy' | 'queue_audit' | 'financial_audit' | 'schedules'
  const [governanceClinicId, setGovernanceClinicId] = useState('');
  const [clinicPolicyForm, setClinicPolicyForm] = useState({
    selfCheckInLeadMinutes: 60,
    selfCheckInGraceMinutes: 30,
    autoExpireOnSettlement: true,
    queuePolicy: 'HYBRID',
  });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyMessage, setPolicyMessage] = useState(null);

  // Queue Audit State
  const [queueAuditLogs, setQueueAuditLogs] = useState([]);
  const [queueAuditTotal, setQueueAuditTotal] = useState(0);
  const [queueAuditPage, setQueueAuditPage] = useState(1);
  const [queueAuditAction, setQueueAuditAction] = useState('');
  const [queueAuditLoading, setQueueAuditLoading] = useState(false);

  // Financial Audit State
  const [financialAuditLogs, setFinancialAuditLogs] = useState([]);
  const [financialAuditTotal, setFinancialAuditTotal] = useState(0);
  const [financialAuditPage, setFinancialAuditPage] = useState(1);
  const [financialAuditAction, setFinancialAuditAction] = useState('');
  const [financialAuditLoading, setFinancialAuditLoading] = useState(false);

  // Admin Doctor Schedules State (Phase 2)
  const [adminDoctors, setAdminDoctors] = useState([]);
  const [adminDoctorsLoading, setAdminDoctorsLoading] = useState(false);
  const [adminDoctorsError, setAdminDoctorsError] = useState(null);
  const [adminDoctorSearch, setAdminDoctorSearch] = useState('');
  const [adminScheduleFilter, setAdminScheduleFilter] = useState('ALL'); // 'ALL' | 'CONFIGURED' | 'UNCONFIGURED'
  const [selectedAdminDoctor, setSelectedAdminDoctor] = useState(null);
  const [scheduleWeeklyHours, setScheduleWeeklyHours] = useState(createEmptyWeeklyHours);
  const [scheduleDuration, setScheduleDuration] = useState(15);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState(null);

  // Admin Operations & Roster State (Phase 6)
  const [adminClinics, setAdminClinics] = useState([]);
  const [adminClinicsLoading, setAdminClinicsLoading] = useState(false);
  const [adminStaffList, setAdminStaffList] = useState([]);
  const [adminStaffLoading, setAdminStaffLoading] = useState(false);
  const [adminRosterFilter, setAdminRosterFilter] = useState('ALL'); // 'ALL' | 'CLINICS' | 'DOCTORS' | 'STAFF'
  const [adminRosterSearch, setAdminRosterSearch] = useState('');

  const initScheduleForDoctor = useCallback((doctor) => {
    if (!doctor) return;
    setSelectedAdminDoctor(doctor);
    setScheduleDuration(doctor.averageConsultationDurationMinutes || 15);
    setScheduleMessage(null);

    const existingHours = Array.isArray(doctor.schedule) ? doctor.schedule : [];
    const hoursMap = new Map();
    for (const day of existingHours) {
      if (day && day.dayOfWeek) {
        hoursMap.set(day.dayOfWeek.toUpperCase(), day);
      }
    }

    const merged = DAYS_OF_WEEK.map((dayName) => {
      const existing = hoursMap.get(dayName);
      if (existing) {
        return {
          dayOfWeek: dayName,
          isWorkingDay: Boolean(existing.isWorkingDay),
          shifts: Array.isArray(existing.shifts)
            ? existing.shifts.map((s) => ({
                startTime: s.startTime || '09:00',
                endTime: s.endTime || '13:00',
              }))
            : [],
          breaks: Array.isArray(existing.breaks)
            ? existing.breaks.map((b) => ({
                startTime: b.startTime || '13:00',
                endTime: b.endTime || '14:00',
                label: b.label || 'Break',
              }))
            : [],
        };
      }
      return {
        dayOfWeek: dayName,
        isWorkingDay: false,
        shifts: [],
        breaks: [],
      };
    });

    setScheduleWeeklyHours(merged);
  }, []);

  const loadAdminDoctors = useCallback(async () => {
    if (!adminToken) return;
    setAdminDoctorsLoading(true);
    setAdminDoctorsError(null);
    const res = await fetchAdminDoctors(adminToken);
    if (res.ok && res.data?.doctors) {
      const docs = res.data.doctors;
      setAdminDoctors(docs);
      setSelectedAdminDoctor((prev) => {
        if (!prev) {
          const first = docs[0] || null;
          if (first) initScheduleForDoctor(first);
          return first;
        }
        const updated = docs.find((d) => d._id === prev._id);
        if (updated) {
          initScheduleForDoctor(updated);
          return updated;
        }
        const first = docs[0] || null;
        if (first) initScheduleForDoctor(first);
        return first;
      });
    } else {
      setAdminDoctorsError(res.data?.message || res.error || 'Failed to load doctors list');
    }
    setAdminDoctorsLoading(false);
  }, [adminToken, initScheduleForDoctor]);

  const handleToggleWorkingDay = (dayIndex) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const nextVal = !target.isWorkingDay;
      target.isWorkingDay = nextVal;
      if (nextVal && (!target.shifts || target.shifts.length === 0)) {
        target.shifts = [{ startTime: '09:00', endTime: '13:00' }];
      }
      if (!nextVal) {
        target.shifts = [];
        target.breaks = [];
      }
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleAddShift = (dayIndex) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const currentShifts = Array.isArray(target.shifts) ? [...target.shifts] : [];
      let nextStart = '14:00';
      let nextEnd = '18:00';
      if (currentShifts.length > 0) {
        const lastShift = currentShifts[currentShifts.length - 1];
        if (lastShift.endTime < '17:00') {
          nextStart = '17:00';
          nextEnd = '20:00';
        } else {
          nextStart = '18:00';
          nextEnd = '21:00';
        }
      }
      currentShifts.push({ startTime: nextStart, endTime: nextEnd });
      target.shifts = currentShifts;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleRemoveShift = (dayIndex, shiftIndex) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      target.shifts = (target.shifts || []).filter((_, idx) => idx !== shiftIndex);
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleShiftChange = (dayIndex, shiftIndex, field, value) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const shifts = [...(target.shifts || [])];
      shifts[shiftIndex] = { ...shifts[shiftIndex], [field]: value };
      target.shifts = shifts;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleAddBreak = (dayIndex) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const currentBreaks = Array.isArray(target.breaks) ? [...target.breaks] : [];
      currentBreaks.push({ startTime: '13:00', endTime: '14:00', label: 'Lunch' });
      target.breaks = currentBreaks;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleRemoveBreak = (dayIndex, breakIndex) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      target.breaks = (target.breaks || []).filter((_, idx) => idx !== breakIndex);
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleBreakChange = (dayIndex, breakIndex, field, value) => {
    setScheduleWeeklyHours((prev) => {
      const copy = [...prev];
      const target = { ...copy[dayIndex] };
      const breaks = [...(target.breaks || [])];
      breaks[breakIndex] = { ...breaks[breakIndex], [field]: value };
      target.breaks = breaks;
      copy[dayIndex] = target;
      return copy;
    });
  };

  const handleApplyMonToFriPreset = () => {
    setScheduleWeeklyHours((prev) => {
      return prev.map((day) => {
        if (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(day.dayOfWeek)) {
          return {
            dayOfWeek: day.dayOfWeek,
            isWorkingDay: true,
            shifts: [
              { startTime: '09:00', endTime: '13:00' },
              { startTime: '16:00', endTime: '20:00' },
            ],
            breaks: [],
          };
        }
        return {
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        };
      });
    });
  };

  const handleApplySingleShiftPreset = () => {
    setScheduleWeeklyHours((prev) => {
      return prev.map((day) => {
        if (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].includes(day.dayOfWeek)) {
          return {
            dayOfWeek: day.dayOfWeek,
            isWorkingDay: true,
            shifts: [{ startTime: '09:00', endTime: '17:00' }],
            breaks: [{ startTime: '13:00', endTime: '14:00', label: 'Lunch Break' }],
          };
        }
        return {
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        };
      });
    });
  };

  const handleMarkAllOffDuty = () => {
    setScheduleWeeklyHours(createEmptyWeeklyHours());
  };

  const handleResetSchedule = () => {
    if (selectedAdminDoctor) {
      initScheduleForDoctor(selectedAdminDoctor);
    }
  };

  const handleSaveSchedule = async (e) => {
    e?.preventDefault();
    if (!selectedAdminDoctor || !adminToken) return;

    const durationNum = Number(scheduleDuration);
    if (isNaN(durationNum) || durationNum < 1) {
      setScheduleMessage({
        type: 'error',
        text: 'Average consultation duration must be a positive integer (minimum 1 minute).',
      });
      return;
    }

    for (const day of scheduleWeeklyHours) {
      if (day.isWorkingDay) {
        if (!day.shifts || day.shifts.length === 0) {
          setScheduleMessage({
            type: 'error',
            text: `${day.dayOfWeek} is marked as a working day but has no shifts configured. Please add a shift or mark it off-duty.`,
          });
          return;
        }
        for (const s of day.shifts) {
          if (!s.startTime || !s.endTime) {
            setScheduleMessage({
              type: 'error',
              text: `Please enter valid start and end times for all shifts on ${day.dayOfWeek}.`,
            });
            return;
          }
          if (s.startTime >= s.endTime) {
            setScheduleMessage({
              type: 'error',
              text: `On ${day.dayOfWeek}, shift start time (${s.startTime}) must be strictly earlier than end time (${s.endTime}).`,
            });
            return;
          }
        }
      }
    }

    setScheduleSaving(true);
    setScheduleMessage(null);

    const payload = {
      weeklyHours: scheduleWeeklyHours,
      averageConsultationDurationMinutes: durationNum,
    };

    const res = await updateDoctorScheduleAdmin(selectedAdminDoctor._id, payload, adminToken);
    setScheduleSaving(false);

    if (res.ok && res.data?.success) {
      setScheduleMessage({
        type: 'success',
        text: `✓ Doctor schedule and consultation duration for Dr. ${selectedAdminDoctor.fullName} saved successfully!`,
      });
      await loadAdminDoctors();
    } else {
      setScheduleMessage({
        type: 'error',
        text: res.data?.message || res.error || 'Failed to update doctor schedule.',
      });
    }
  };

  const filteredAdminDoctors = adminDoctors.filter((doc) => {
    if (adminScheduleFilter === 'CONFIGURED' && !doc.hasSchedule) return false;
    if (adminScheduleFilter === 'UNCONFIGURED' && doc.hasSchedule) return false;
    if (adminDoctorSearch.trim()) {
      const q = adminDoctorSearch.toLowerCase();
      const matchName = doc.fullName?.toLowerCase().includes(q);
      const matchSpecialty = doc.specialtyId?.name?.toLowerCase().includes(q);
      const matchClinic = doc.clinicId?.name?.toLowerCase().includes(q);
      if (!matchName && !matchSpecialty && !matchClinic) return false;
    }
    return true;
  });

  const loadClinicPolicy = useCallback(async (cId) => {
    const targetClinicId = cId || governanceClinicId || doctors[0]?.clinicId?._id || doctors[0]?.clinicId;
    if (!targetClinicId || !adminToken) return;
    setPolicyLoading(true);
    const res = await getClinicOperationalPolicy(targetClinicId, adminToken);
    if (res.ok && res.data?.policy) {
      setClinicPolicyForm({
        selfCheckInLeadMinutes: res.data.policy.selfCheckInLeadMinutes ?? 60,
        selfCheckInGraceMinutes: res.data.policy.selfCheckInGraceMinutes ?? 30,
        autoExpireOnSettlement: res.data.policy.autoExpireOnSettlement ?? true,
        queuePolicy: res.data.queuePolicy || 'HYBRID',
      });
      if (!governanceClinicId) setGovernanceClinicId(targetClinicId);
    }
    setPolicyLoading(false);
  }, [governanceClinicId, doctors, adminToken]);

  const handleSaveClinicPolicy = async (e) => {
    e?.preventDefault();
    const targetClinicId = governanceClinicId || doctors[0]?.clinicId?._id || doctors[0]?.clinicId;
    if (!targetClinicId || !adminToken) return;
    setPolicyLoading(true);
    setPolicyMessage(null);
    const res = await updateClinicOperationalPolicy(targetClinicId, {
      selfCheckInLeadMinutes: Number(clinicPolicyForm.selfCheckInLeadMinutes),
      selfCheckInGraceMinutes: Number(clinicPolicyForm.selfCheckInGraceMinutes),
      autoExpireOnSettlement: Boolean(clinicPolicyForm.autoExpireOnSettlement),
      queuePolicy: clinicPolicyForm.queuePolicy,
    }, adminToken);
    if (res.ok && res.data?.success) {
      setPolicyMessage('✓ Clinic operational policy updated successfully!');
    } else {
      setPolicyMessage(`Policy update failed: ${res.data?.message || res.error || 'Server error'}`);
    }
    setPolicyLoading(false);
  };

  const loadQueueAuditLogs = useCallback(async (page = 1) => {
    if (!adminToken) return;
    setQueueAuditLoading(true);
    const params = { page, limit: 25 };
    if (queueAuditAction) params.action = queueAuditAction;
    if (governanceClinicId) params.clinicId = governanceClinicId;
    const res = await fetchQueueAuditHistory(params, adminToken);
    if (res.ok && res.data) {
      setQueueAuditLogs(res.data.logs || []);
      setQueueAuditTotal(res.data.total || 0);
      setQueueAuditPage(res.data.page || 1);
    }
    setQueueAuditLoading(false);
  }, [adminToken, queueAuditAction, governanceClinicId]);

  const loadFinancialAuditLogs = useCallback(async (page = 1) => {
    if (!adminToken) return;
    setFinancialAuditLoading(true);
    const params = { page, limit: 25 };
    if (financialAuditAction) params.action = financialAuditAction;
    if (governanceClinicId) params.clinicId = governanceClinicId;
    const res = await fetchFinancialAuditHistory(params, adminToken);
    if (res.ok && res.data) {
      setFinancialAuditLogs(res.data.logs || []);
      setFinancialAuditTotal(res.data.total || 0);
      setFinancialAuditPage(res.data.page || 1);
    }
    setFinancialAuditLoading(false);
  }, [adminToken, financialAuditAction, governanceClinicId]);

  const loadAdminRosterData = useCallback(async () => {
    if (!adminToken) return;
    setAdminClinicsLoading(true);
    setAdminStaffLoading(true);
    setAdminDoctorsLoading(true);
    try {
      const [clinicsRes, staffRes, doctorsRes] = await Promise.all([
        fetchAdminClinics(adminToken),
        fetchAdminStaff(adminToken),
        fetchAdminDoctors(adminToken),
      ]);
      if (clinicsRes.ok && clinicsRes.data?.clinics) {
        setAdminClinics(clinicsRes.data.clinics);
      }
      if (staffRes.ok && staffRes.data?.staff) {
        setAdminStaffList(staffRes.data.staff);
      }
      if (doctorsRes.ok && doctorsRes.data?.doctors) {
        setAdminDoctors(doctorsRes.data.doctors);
      }
    } catch (err) {
      console.error('Failed to load admin roster:', err);
    } finally {
      setAdminClinicsLoading(false);
      setAdminStaffLoading(false);
      setAdminDoctorsLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (!receptionDoctorId && doctors.length > 0) {
      setReceptionDoctorId(doctors[0]._id);
    }
  }, [receptionDoctorId, doctors]);

  useEffect(() => {
    if (viewTab === 'governance' && adminToken) {
      if (adminSubTab === 'policy') loadClinicPolicy();
      if (adminSubTab === 'queue_audit') loadQueueAuditLogs(1);
      if (adminSubTab === 'financial_audit') loadFinancialAuditLogs(1);
      if (adminSubTab === 'schedules') loadAdminDoctors();
      if (adminSubTab === 'roster') loadAdminRosterData();
    }
  }, [viewTab, adminSubTab, adminToken, loadClinicPolicy, loadQueueAuditLogs, loadFinancialAuditLogs, loadAdminDoctors, loadAdminRosterData]);

  // Live Queue & Public Polling
  const loadLiveQueue = useCallback(async () => {
    if (!patientToken) return;
    const res = await getPatientLiveQueue(patientToken);
    if (res.ok && res.data) {
      setLiveQueueData(res.data);
    }
  }, [patientToken]);

  useEffect(() => {
    if (viewTab === 'live_queue' && patientToken && isTabVisible) {
      loadLiveQueue();
      const interval = setInterval(loadLiveQueue, 10000);
      return () => clearInterval(interval);
    }
  }, [viewTab, patientToken, isTabVisible, loadLiveQueue]);

  const loadPublicDisplay = useCallback(async () => {
    if (!publicClinicId) return;
    const res = await fetchPublicQueueDisplay(publicClinicId);
    if (res.ok && res.data) {
      setPublicDisplayData(res.data);
    }
  }, [publicClinicId]);

  useEffect(() => {
    if (viewTab === 'public_display' && publicClinicId && isTabVisible) {
      loadPublicDisplay();
      const interval = setInterval(loadPublicDisplay, 10000);
      return () => clearInterval(interval);
    }
  }, [viewTab, publicClinicId, isTabVisible, loadPublicDisplay]);

  // Billing Handlers
  const loadPatientInvoices = useCallback(async () => {
    if (!patientToken) return;
    const res = await fetchPatientInvoices(patientToken);
    if (res.ok && res.data) {
      setPatientInvoices(res.data.invoices || []);
    }
  }, [patientToken]);

  useEffect(() => {
    if (viewTab === 'billing' && patientToken) {
      loadPatientInvoices();
    }
  }, [viewTab, patientToken, loadPatientInvoices]);

  const handlePayInvoice = async (invoiceId) => {
    if (!patientToken) return;
    const res = await initiatePatientPayment({ invoiceId, paymentMethod: 'UPI' }, patientToken);
    if (res.ok) {
      alert(`✓ Payment processed successfully! Transaction: ${res.data.payment?.transactionReference}`);
      loadPatientInvoices();
    } else {
      alert(`Payment failed: ${res.data?.message || res.error}`);
    }
  };

  // Auth Modal Handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (authMode === 'login') {
      const res = await loginUser({ email: authForm.email, password: authForm.password });
      if (res.ok && res.data?.token) {
        setAuthSession({ user: res.data.user, token: res.data.token });
        setShowAuthModal(false);
      } else {
        setAuthError(res.data?.message || res.error || 'Login failed');
      }
    } else {
      const res = await registerUser(authForm);
      if (res.ok && res.data?.token) {
        setAuthSession({ user: res.data.user, token: res.data.token });
        setShowAuthModal(false);
      } else {
        setAuthError(res.data?.message || res.error || 'Registration failed');
      }
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    setAuthSession(null);
    setPatientToken('');
    setStaffToken('');
    setDoctorToken('');
    setAdminToken('');
    setViewTab('discover');
  };

  return (
    <div className="app-shell">
      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-group" onClick={() => setViewTab('discover')}>
            <div className="brand-icon-wrapper">
              <IconPulse />
            </div>
            <div className="brand-text-block">
              <div className="brand-title">QFlow</div>
              <div className="brand-badge">
                <span className="status-dot-pulse" /> Healthcare OS
              </div>
            </div>
          </div>

          {/* Quick Context & User Profile */}
          <div className="header-actions">
            {/* Location Pill Quick Status */}
            <div
              className="user-profile-badge"
              style={{ cursor: 'pointer' }}
              onClick={handleGetLocation}
              title={locStatus}
            >
              <div style={{ color: 'var(--primary-light)', display: 'flex' }}>
                <IconLocation />
              </div>
              <span style={{ fontSize: '0.78rem', color: coords ? 'var(--status-success)' : 'var(--text-muted)' }}>
                {locLoading ? 'Locating...' : coords ? `📍 ${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}` : 'Location'}
              </span>
            </div>

            {/* Notification Bell (Patient Only) */}
            {currentRole === 'PATIENT' && (
              <button
                className="btn-icon"
                onClick={() => setShowNotificationDrawer(true)}
                title="Notifications"
              >
                <IconBell />
                {unreadCount > 0 && (
                  <span className="unread-badge">{unreadCount}</span>
                )}
              </button>
            )}

            {authSession?.user ? (
              <div className="user-profile-badge">
                <div className="user-avatar-circle">
                  {(authSession.user.name || authSession.user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="user-info-text">
                  <div className="user-name-text">{authSession.user.name || authSession.user.email?.split('@')[0] || 'User'}</div>
                  <div className="user-role-badge">{currentRole}</div>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.25rem' }}
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Role-Based Secondary Navigation Bar */}
      <nav className="nav-subbar">
        <div className="nav-subbar-inner">
          {/* Patient / Guest Views */}
          {(currentRole === 'GUEST' || currentRole === 'PATIENT') && (
            <button
              className={`nav-tab-btn ${viewTab === 'discover' ? 'active' : ''}`}
              onClick={() => setViewTab('discover')}
            >
              <IconSearch /> Find Specialists
            </button>
          )}

          {currentRole === 'PATIENT' && (
            <>
              <button
                className={`nav-tab-btn ${viewTab === 'my_appointments' ? 'active' : ''}`}
                onClick={() => setViewTab('my_appointments')}
              >
                Appointments
              </button>
              <button
                className={`nav-tab-btn ${viewTab === 'live_queue' ? 'active' : ''}`}
                onClick={() => setViewTab('live_queue')}
              >
                Live Queue
              </button>
              <button
                className={`nav-tab-btn ${viewTab === 'billing' ? 'active' : ''}`}
                onClick={() => setViewTab('billing')}
              >
                Invoices & Payments
              </button>
            </>
          )}

          {/* Doctor View */}
          {currentRole === 'DOCTOR' && (
            <button
              className={`nav-tab-btn ${viewTab === 'doctor_cockpit' ? 'active' : ''}`}
              onClick={() => setViewTab('doctor_cockpit')}
            >
              Clinical Cockpit
            </button>
          )}

          {/* Staff & Admin Views */}
          {(currentRole === 'STAFF' || currentRole === 'ADMIN') && (
            <>
              <button
                className={`nav-tab-btn ${viewTab === 'reception' ? 'active' : ''}`}
                onClick={() => setViewTab('reception')}
              >
                Reception Desk
              </button>
              <button
                className={`nav-tab-btn ${viewTab === 'settlement' ? 'active' : ''}`}
                onClick={() => setViewTab('settlement')}
              >
                Day Settlement
              </button>
              <button
                className={`nav-tab-btn ${viewTab === 'billing' ? 'active' : ''}`}
                onClick={() => setViewTab('billing')}
              >
                Billing & Refunds
              </button>
            </>
          )}

          {/* Analytics & Intelligence Views */}
          {(currentRole === 'STAFF' || currentRole === 'DOCTOR' || currentRole === 'ADMIN') && (
            <>
              <button
                className={`nav-tab-btn ${viewTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setViewTab('analytics')}
              >
                Analytics
              </button>
              <button
                className={`nav-tab-btn ${viewTab === 'intelligence' ? 'active' : ''}`}
                onClick={() => setViewTab('intelligence')}
              >
                AI Insights
              </button>
            </>
          )}

          {/* Admin Governance View (Phase 15) */}
          {currentRole === 'ADMIN' && (
            <button
              className={`nav-tab-btn ${viewTab === 'governance' ? 'active' : ''}`}
              onClick={() => setViewTab('governance')}
            >
              Governance Plane
            </button>
          )}

          {/* Public Kiosk Display (All Roles & Guest) */}
          <button
            className={`nav-tab-btn ${viewTab === 'public_display' ? 'active' : ''}`}
            onClick={() => setViewTab('public_display')}
          >
            Public Display
          </button>
        </div>
      </nav>

      {/* Main Application Container Canvas */}
      <main className="app-container">

      {/* VIEW: Doctor Examination Cockpit (Phase 13) */}
      {/* VIEW: Doctor Examination Cockpit & Workspace (Phase 5) */}
      {viewTab === 'doctor_cockpit' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {/* Header & Sub-Tabs Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', margin: 0 }}>🩺 Doctor Clinical Workspace</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Live exam room workflow, consultation records, and recurring practice schedule management
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className={`btn ${doctorSubTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => setDoctorSubTab('queue')}
              >
                🚪 Live Exam & Queue
              </button>
              <button
                className={`btn ${doctorSubTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  setDoctorSubTab('appointments');
                  loadDoctorAppointments();
                }}
              >
                📅 Consultations & Appointments
              </button>
              <button
                className={`btn ${doctorSubTab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  setDoctorSubTab('schedule');
                  loadDoctorSelfSchedule();
                }}
              >
                ⏰ My Practice Schedule
              </button>
            </div>
          </div>

          {doctorMessage && (
            <div style={{ background: '#1c1917', border: '1px solid var(--primary)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-main)', marginBottom: '1rem' }}>
              {doctorMessage}
            </div>
          )}

          {/* SUB-TAB 1: Live Exam & Queue (Existing Cockpit) */}
          {doctorSubTab === 'queue' && (
            <div>
              {/* Live Operational Status Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090d16', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.25rem', flexWrap: 'gap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Practice Status:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['AVAILABLE', 'BUSY', 'ON_BREAK', 'UNAVAILABLE', 'OFFLINE'].map((st) => (
                    <button
                      key={st}
                      disabled={doctorOpLoading}
                      className={`btn ${doctorLiveStatus === st ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                      onClick={() => handleDoctorStatusUpdate(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top Operational Metrics Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Today Completed</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {doctorIntel?.todayCompletedCount ?? 0} Patients
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Currently Waiting</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#eab308' }}>
                    {doctorQueueData.length} In Queue
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg Speed (Configured)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#38bdf8' }}>
                    {doctorIntel?.configuredAvgDurationMin ?? 15} mins
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Predicted Next Duration</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#a78bfa' }}>
                    {doctorIntel?.durationPrediction?.predictedDurationMinutes ?? 15} mins
                  </div>
                </div>
              </div>

              {/* Active Examination Room Card */}
              <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🚪 Examination Room Status</span>
                  {doctorActivePatient && (
                    <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: doctorActivePatient.status === 'IN_CONSULTATION' ? '#065f46' : '#854d0e', color: '#fff' }}>
                      {doctorActivePatient.status}
                    </span>
                  )}
                </h3>

                {doctorActivePatient ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Token Number:</span>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                          #{doctorActivePatient.tokenNumber}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Patient Name:</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                          {doctorActivePatient.patientId?.fullName || 'Patient'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Source / Priority:</span>
                        <div style={{ fontSize: '1rem' }}>
                          {doctorActivePatient.source} | {doctorActivePatient.priority}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {doctorActivePatient.status === 'CALLED' && (
                        <button className="btn btn-primary" disabled={doctorOpLoading} onClick={handleDoctorStartConsultation}>
                          ▶ Start Consultation
                        </button>
                      )}
                      {doctorActivePatient.status === 'IN_CONSULTATION' && (
                        <button className="btn btn-primary" disabled={doctorOpLoading} onClick={handleDoctorCompleteConsultation}>
                          ✓ Complete Consultation
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    <p>No patient is currently in the examination room.</p>
                    <button className="btn btn-primary" disabled={doctorOpLoading || doctorQueueData.length === 0} onClick={handleDoctorCallNext}>
                      📢 Call Next Patient
                    </button>
                  </div>
                )}
              </div>

              {/* Today's Waiting Queue Table */}
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>
                📋 Waiting Queue ({doctorQueueData.length})
              </h3>
              {doctorQueueData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: '#090d16', borderRadius: '8px' }}>
                  No patients waiting in queue today.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Patient</th>
                        <th>Source</th>
                        <th>Priority</th>
                        <th>Joined At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorQueueData.map((q) => (
                        <tr key={q._id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>#{q.tokenNumber}</td>
                          <td>{q.patientId?.fullName || 'Patient'}</td>
                          <td>{q.source}</td>
                          <td>{q.priority}</td>
                          <td>{new Date(q.joinedAt).toLocaleTimeString()}</td>
                          <td>
                            {!doctorActivePatient && (
                              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={handleDoctorCallNext}>
                                Call
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: Consultations & Appointments (Phase 5) */}
          {doctorSubTab === 'appointments' && (
            <div className="doctor-appts-container">
              {/* Filter & Search Bar */}
              <div className="doctor-filter-bar">
                {/* Scope selector */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn btn-xs ${doctorApptScope === 'today' && !doctorApptDate ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => {
                      setDoctorApptScope('today');
                      setDoctorApptDate('');
                      loadDoctorAppointments('today', '');
                    }}
                  >
                    📅 Today
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${doctorApptScope === 'upcoming' && !doctorApptDate ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => {
                      setDoctorApptScope('upcoming');
                      setDoctorApptDate('');
                      loadDoctorAppointments('upcoming', '');
                    }}
                  >
                    🔜 Upcoming
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${doctorApptScope === 'past' && !doctorApptDate ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => {
                      setDoctorApptScope('past');
                      setDoctorApptDate('');
                      loadDoctorAppointments('past', '');
                    }}
                  >
                    📜 Past & History
                  </button>
                </div>

                {/* Specific Date & Search Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date:</span>
                    <input
                      type="date"
                      className="filter-input"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                      value={doctorApptDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDoctorApptDate(val);
                        if (val) {
                          loadDoctorAppointments('', val);
                        } else {
                          loadDoctorAppointments(doctorApptScope, '');
                        }
                      }}
                    />
                  </div>

                  <input
                    type="text"
                    className="filter-input"
                    placeholder="Search patient, phone, ID..."
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', minWidth: '180px' }}
                    value={doctorApptSearch}
                    onChange={(e) => setDoctorApptSearch(e.target.value)}
                  />

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => loadDoctorAppointments()}
                    disabled={doctorApptLoading}
                  >
                    {doctorApptLoading ? 'Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {doctorApptError && (
                <div style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fee2e2', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⚠️ {doctorApptError}</span>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => loadDoctorAppointments()}>
                    Retry
                  </button>
                </div>
              )}

              {/* Appointments List / Grid */}
              {doctorApptLoading && doctorAppointments.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  Loading appointments...
                </div>
              ) : (() => {
                const query = doctorApptSearch.toLowerCase().trim();
                const filtered = doctorAppointments.filter((a) => {
                  if (!query) return true;
                  const patientName = (a.patientId?.fullName || '').toLowerCase();
                  const patientPhone = (a.patientId?.phone || '').toLowerCase();
                  const apptId = (a._id || '').toLowerCase();
                  return patientName.includes(query) || patientPhone.includes(query) || apptId.includes(query);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center', background: '#090d16', borderRadius: '8px' }}>
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        {doctorApptSearch
                          ? `No appointments found matching "${doctorApptSearch}".`
                          : `No appointments found for the selected ${doctorApptDate ? `date (${doctorApptDate})` : doctorApptScope} view.`}
                      </p>
                      {doctorApptSearch && (
                        <button
                          className="btn btn-secondary"
                          style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => setDoctorApptSearch('')}
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="doctor-appts-grid">
                    {filtered.map((appt) => {
                      const patient = appt.patientId;
                      const age = patient?.dateOfBirth ? getAgeFromDob(patient.dateOfBirth) : null;
                      const isBooked = appt.status === 'BOOKED';
                      const isCancelled = appt.status === 'CANCELLED';
                      const isCompleted = appt.status === 'COMPLETED';

                      let badgeClass = 'badge-secondary';
                      if (isBooked) badgeClass = 'badge-primary';
                      if (isCompleted) badgeClass = 'badge-success';
                      if (isCancelled) badgeClass = 'badge-danger';

                      return (
                        <div key={appt._id} className="doctor-appt-card">
                          <div className="doctor-appt-card-header">
                            <div>
                              <div className="doctor-appt-patient-name">
                                {patient?.fullName || 'Walk-in / Unregistered Patient'}
                              </div>
                              <div className="doctor-appt-patient-meta">
                                {patient?.gender && <span>{patient.gender}</span>}
                                {age !== null && <span>• {age} yrs</span>}
                                {patient?.phone && <span>• 📞 {patient.phone}</span>}
                              </div>
                            </div>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem' }}>
                              {appt.status}
                            </span>
                          </div>

                          <div className="doctor-appt-time-slot">
                            <span style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
                              🗓️ {appt.appointmentDate}
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              ⏰ {appt.timeSlot?.startTime} – {appt.timeSlot?.endTime}
                            </span>
                          </div>

                          <div className="doctor-appt-details">
                            {appt.clinicId && (
                              <div>🏥 <strong>{appt.clinicId.name}</strong> {appt.clinicId.address ? `(${appt.clinicId.address})` : ''}</div>
                            )}
                            {appt.specialtyId && (
                              <div>🩺 Specialty: {appt.specialtyId.name}</div>
                            )}
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              Ref: <code>#{appt._id}</code>
                            </div>
                            {isCancelled && (
                              <div style={{ marginTop: '0.25rem', color: '#f87171', fontSize: '0.78rem' }}>
                                <div><strong>Cancelled:</strong> {appt.cancelledAt ? new Date(appt.cancelledAt).toLocaleString() : 'N/A'}</div>
                                {appt.cancellationReason && <div><strong>Reason:</strong> {appt.cancellationReason}</div>}
                              </div>
                            )}
                          </div>

                          <div className="doctor-appt-actions">
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              Consultation Slot
                            </span>
                            {isBooked && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', color: 'var(--status-danger)' }}
                                onClick={() => setDoctorCancelModal({ isOpen: true, appointment: appt, reason: '', loading: false, error: null })}
                              >
                                Cancel Consultation
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-TAB 3: My Practice Schedule (Phase 5) */}
          {doctorSubTab === 'schedule' && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {/* Doctor Practice Header */}
              <div className="admin-doc-editor-header" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem' }}>
                    ⏰ Recurring Practice Schedule & Consultation Duration
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {doctorProfileData?.fullName ? `Dr. ${doctorProfileData.fullName}` : 'My Account'} • Clinic: <strong>{doctorProfileData?.clinic?.name || 'Assigned Clinic'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      Consultation Duration
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="number"
                        min="1"
                        max="240"
                        className="filter-input"
                        value={doctorScheduleDuration}
                        onChange={(e) => setDoctorScheduleDuration(e.target.value)}
                        style={{ width: '80px', textAlign: 'center', padding: '0.3rem 0.5rem', fontWeight: 600 }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>min</span>
                    </div>
                  </div>
                </div>
              </div>

              {doctorScheduleMessage && (
                <div style={{ background: doctorScheduleMessage.includes('✅') ? '#064e3b' : '#451a03', border: `1px solid ${doctorScheduleMessage.includes('✅') ? '#10b981' : '#f59e0b'}`, padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                  {doctorScheduleMessage}
                </div>
              )}

              {/* Quick Presets */}
              <div className="admin-schedule-presets-bar">
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Quick Presets:
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  onClick={handleDoctorApplyMonToFriPreset}
                  title="Set Mon-Fri 09:00-13:00 and 16:00-20:00"
                >
                  ⚡ Mon–Fri (Two Shifts: 9-1, 4-8)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  onClick={handleDoctorApplySingleShiftPreset}
                  title="Set Mon-Sat 09:00-17:00 with 1h Lunch Break"
                >
                  ⚡ Mon–Sat (9-5 + Lunch)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', color: 'var(--status-danger)' }}
                  onClick={handleDoctorMarkAllOffDuty}
                  title="Set all days to off-duty"
                >
                  🚫 Mark All Off-Duty
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  onClick={loadDoctorSelfSchedule}
                  disabled={doctorScheduleLoading}
                  title="Discard changes and reload saved schedule"
                >
                  ↺ Reset Changes
                </button>
              </div>

              {/* 7-Day Schedule Editor */}
              {doctorScheduleLoading ? (
                <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  Loading schedule details...
                </div>
              ) : (
                <div className="admin-schedule-days-list">
                  {doctorScheduleWeeklyHours.map((dayObj, dayIdx) => (
                    <div
                      key={dayObj.dayOfWeek}
                      className={`admin-schedule-day-card ${dayObj.isWorkingDay ? 'day-active' : 'day-inactive'}`}
                    >
                      <div className="day-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <label className="day-toggle-label">
                            <input
                              type="checkbox"
                              checked={dayObj.isWorkingDay}
                              onChange={() => handleDoctorToggleWorkingDay(dayIdx)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                            />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: dayObj.isWorkingDay ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {dayObj.dayOfWeek}
                            </span>
                          </label>
                          {dayObj.isWorkingDay ? (
                            <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                              Working ({dayObj.shifts?.length || 0} shift{dayObj.shifts?.length === 1 ? '' : 's'})
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', opacity: 0.7 }}>
                              Off-Duty
                            </span>
                          )}
                        </div>
                        {dayObj.isWorkingDay && (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleDoctorAddShift(dayIdx)}
                            >
                              + Add Shift
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleDoctorAddBreak(dayIdx)}
                            >
                              + Add Break
                            </button>
                          </div>
                        )}
                      </div>

                      {dayObj.isWorkingDay && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {/* Shifts */}
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Working Shifts:
                            </div>
                            {(!dayObj.shifts || dayObj.shifts.length === 0) ? (
                              <div style={{ fontSize: '0.75rem', color: '#f87171', fontStyle: 'italic' }}>
                                ⚠️ Working day must have at least one shift
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {dayObj.shifts.map((shift, sIdx) => (
                                  <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', width: '50px' }}>
                                      Shift {sIdx + 1}:
                                    </span>
                                    <input
                                      type="time"
                                      className="filter-input"
                                      value={shift.startTime}
                                      onChange={(e) => handleDoctorShiftChange(dayIdx, sIdx, 'startTime', e.target.value)}
                                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.45rem' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                                    <input
                                      type="time"
                                      className="filter-input"
                                      value={shift.endTime}
                                      onChange={(e) => handleDoctorShiftChange(dayIdx, sIdx, 'endTime', e.target.value)}
                                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.45rem' }}
                                    />
                                    {dayObj.shifts.length > 1 && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', color: 'var(--status-danger)' }}
                                        onClick={() => handleDoctorRemoveShift(dayIdx, sIdx)}
                                        title="Remove Shift"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Breaks */}
                          {Array.isArray(dayObj.breaks) && dayObj.breaks.length > 0 && (
                            <div style={{ marginTop: '0.35rem' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                Scheduled Breaks:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {dayObj.breaks.map((brk, bIdx) => (
                                  <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <input
                                      type="text"
                                      className="filter-input"
                                      value={brk.label || 'Break'}
                                      placeholder="Break Name"
                                      onChange={(e) => handleDoctorBreakChange(dayIdx, bIdx, 'label', e.target.value)}
                                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.45rem', width: '90px' }}
                                    />
                                    <input
                                      type="time"
                                      className="filter-input"
                                      value={brk.startTime}
                                      onChange={(e) => handleDoctorBreakChange(dayIdx, bIdx, 'startTime', e.target.value)}
                                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.45rem' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                                    <input
                                      type="time"
                                      className="filter-input"
                                      value={brk.endTime}
                                      onChange={(e) => handleDoctorBreakChange(dayIdx, bIdx, 'endTime', e.target.value)}
                                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.45rem' }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', color: 'var(--status-danger)' }}
                                      onClick={() => handleDoctorRemoveBreak(dayIdx, bIdx)}
                                      title="Remove Break"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Save & Reset Footer */}
              <div className="admin-schedule-footer-bar">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDoctorScheduleSave}
                  disabled={doctorScheduleSaving}
                >
                  {doctorScheduleSaving ? 'Saving Schedule...' : '💾 Save Practice Schedule'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={loadDoctorSelfSchedule}
                  disabled={doctorScheduleSaving}
                >
                  ↺ Discard Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Find / Discover Doctors */}
      {viewTab === 'discover' && (
        <div className="discovery-layout">
          {/* Healthcare SaaS Hero Section */}
          <section className="hero-section" aria-label="Healthcare platform introduction">
            <div className="hero-container">
              {/* Left Column: Editorial Headline, Supporting Copy, Actions & Trust Bar */}
              <div className="hero-content">
                <div className="hero-pill">
                  <IconPulse />
                  <span>Intelligent healthcare queue platform</span>
                </div>
                <h1 className="hero-title">
                  Precision Care, <span className="hero-title-gradient">Zero Wait-Room Friction.</span>
                </h1>
                <p className="hero-subtitle">
                  Discover verified medical specialists, monitor live consultation pacing in real time, and check in effortlessly from anywhere.
                </p>
                <div className="hero-cta-group">
                  <button
                    className="btn btn-primary hero-btn-primary"
                    onClick={() => {
                      const el = document.getElementById('discovery-controls');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        const input = el.querySelector('input');
                        if (input) input.focus();
                      }
                    }}
                  >
                    <IconSearch />
                    <span>Find Specialists</span>
                  </button>
                  <button
                    className="btn btn-secondary hero-btn-secondary"
                    onClick={handleGetLocation}
                    title={locStatus}
                  >
                    <IconLocation />
                    <span>{locLoading ? 'Locating...' : coords ? 'Location Active' : 'Explore Nearby'}</span>
                  </button>
                </div>
                <div className="hero-trust-bar">
                  <div className="trust-item">
                    <IconShield />
                    <span>Verified Specialists</span>
                  </div>
                  <div className="trust-item">
                    <IconActivity />
                    <span>Live Telemetry & AI Pacing</span>
                  </div>
                  <div className="trust-item">
                    <IconClock />
                    <span>Synchronized Clinic Queues</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Premium Healthcare Photographic Carousel */}
              <div className="hero-visual">
                <HeroCarousel />
              </div>
            </div>
          </section>

          {/* Discovery Command Surface */}
          <div className="discovery-controls-card" id="discovery-controls">
            {/* Contextual Geolocation Bar */}
            <div className="location-row">
              <div className="location-meta">
                <div className="location-icon-box">
                  <IconLocation />
                </div>
                <div className="location-text-col">
                  <span className="location-label">Your Location</span>
                  <span className="location-status-text">{locStatus}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleGetLocation}
                disabled={locLoading}
              >
                {locLoading ? (
                  <>
                    <span className="status-dot-pulse" style={{ background: 'var(--primary-light)' }} />
                    Detecting GPS...
                  </>
                ) : (
                  <>
                    <IconLocation />
                    <span>Use Current Location</span>
                  </>
                )}
              </button>
            </div>

            {/* Specialties Filter Chips */}
            <div className="specialties-section">
              <div className="specialties-header">
                <span>Browse By Clinical Specialty</span>
                {selectedSpecialty && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '0.1rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => setSelectedSpecialty('')}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="categories-bar">
                <button
                  className={`category-chip ${selectedSpecialty === '' ? 'active' : ''}`}
                  onClick={() => setSelectedSpecialty('')}
                >
                  All Specialties
                </button>
                {specialties.map((s) => (
                  <button
                    key={s._id}
                    className={`category-chip ${selectedSpecialty === s._id ? 'active' : ''}`}
                    onClick={() => setSelectedSpecialty(s._id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Precision Filter Toolbar */}
            <div className="filters-panel">
              <div className="filter-group">
                <label className="filter-label">Sort Priority</label>
                <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="rating">★ Highest Rated</option>
                  <option value="experience">🎖 Most Experienced</option>
                  {coords && <option value="nearest">📍 Nearest Distance</option>}
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Minimum Rating</label>
                <select className="filter-select" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                  <option value="">Any Rating</option>
                  <option value="4.5">★ 4.5+ Stars</option>
                  <option value="4.0">★ 4.0+ Stars</option>
                  <option value="3.5">★ 3.5+ Stars</option>
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Max Consultation Fee</label>
                <input
                  type="number"
                  className="filter-input"
                  placeholder="e.g. ₹1000"
                  value={maxFee}
                  onChange={(e) => setMaxFee(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="results-header-row">
            <div className="results-count-title">
              <span>Available Practitioners</span>
              {!loading && !error && (
                <span className="results-count-badge">
                  {doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'}
                </span>
              )}
            </div>
          </div>

          {/* Doctors Grid / Shimmer / Empty State */}
          {loading ? (
            <div className="doctors-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton-card" aria-hidden="true">
                  <div className="doc-card-top">
                    <div className="skeleton-shimmer" style={{ width: 60, height: 60, borderRadius: '12px', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
                      <div className="skeleton-shimmer" style={{ height: 22, width: '65%', borderRadius: '4px' }} />
                      <div className="skeleton-shimmer" style={{ height: 15, width: '42%', borderRadius: '4px' }} />
                      <div className="skeleton-shimmer" style={{ height: 14, width: '75%', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '1.25rem 0 0.85rem 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div className="skeleton-shimmer" style={{ height: 11, width: '50%' }} />
                      <div className="skeleton-shimmer" style={{ height: 16, width: '70%' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div className="skeleton-shimmer" style={{ height: 11, width: '50%' }} />
                      <div className="skeleton-shimmer" style={{ height: 16, width: '70%' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div className="skeleton-shimmer" style={{ height: 11, width: '50%' }} />
                      <div className="skeleton-shimmer" style={{ height: 16, width: '70%' }} />
                    </div>
                  </div>
                  <div className="skeleton-shimmer" style={{ height: 13, width: '50%', marginBottom: '1.25rem' }} />
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <div className="skeleton-shimmer" style={{ height: 42, flex: 1, borderRadius: 'var(--radius-md)' }} />
                    <div className="skeleton-shimmer" style={{ height: 42, flex: 1.5, borderRadius: 'var(--radius-md)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="empty-state-card">
              <div className="empty-state-icon" style={{ color: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.1)' }}>
                <IconShield />
              </div>
              <div className="empty-state-title">Unable to Load Doctors</div>
              <div className="empty-state-desc">{error}</div>
              <button className="btn btn-secondary" onClick={loadDiscovery}>
                Try Again
              </button>
            </div>
          ) : doctors.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <IconSearch />
              </div>
              <div className="empty-state-title">No Practitioners Found</div>
              <div className="empty-state-desc">
                We couldn't find any medical specialists matching your active filters. Try resetting the filters or widening your distance criteria.
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedSpecialty('');
                  setMinRating('');
                  setMaxFee('');
                  setSort('rating');
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="doctors-grid">
              {doctors.map((d) => (
                <DoctorDiscoveryCard
                  key={d._id}
                  doctor={d}
                  onOpenProfile={handleOpenProfile}
                  onBookAppointment={handleProceedToAppointment}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: My Appointments (Patient) */}
      {viewTab === 'my_appointments' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>📅 My Appointments</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Track your upcoming consultations, self-check-in upon arrival, or cancel and rebook slots.
              </div>
            </div>
            {patientToken && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                onClick={() => {
                  setAppointmentMessage(null);
                  loadMyAppointments();
                }}
              >
                🔄 Refresh Appointments
              </button>
            )}
          </div>

          {!patientToken ? (
            <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Please Sign In to View Your Appointments
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Access your scheduled consultations, token queue tickets, and appointment history.
              </div>
              <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
                Sign In / Register
              </button>
            </div>
          ) : (
            <>
              {appointmentMessage && (
                <div
                  style={{
                    background: appointmentMessage.type === 'success' ? '#064e3b' : '#451a03',
                    border: `1px solid ${appointmentMessage.type === 'success' ? '#10b981' : '#f59e0b'}`,
                    color: appointmentMessage.type === 'success' ? '#a7f3d0' : '#fef3c7',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                  }}
                >
                  {appointmentMessage.text}
                </div>
              )}

              {selfCheckInMessage && (
                <div style={{ background: '#090d16', border: '1px solid var(--primary)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', color: '#6ee7b7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>{selfCheckInMessage}</div>
                  {selfCheckInMessage.includes('Token') && (
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }} onClick={() => setViewTab('live_queue')}>
                      Go to Live Queue Tracker →
                    </button>
                  )}
                </div>
              )}

              {myAppointments.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    No Appointments Booked Yet
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Discover our specialists and reserve consultation slots that suit your schedule.
                  </div>
                  <button className="btn btn-primary" onClick={() => setViewTab('discovery')}>
                    Find a Doctor & Book →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myAppointments.map((appt) => {
                    const slotTime = appt.timeSlot?.startTime
                      ? `${appt.timeSlot.startTime} - ${appt.timeSlot.endTime}`
                      : (appt.slotTime || '');
                    const isCancelling = cancellationLoadingId === appt._id;
                    const docObj = appt.doctorId || {};

                    return (
                      <div
                        key={appt._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#090d16',
                          padding: '1rem 1.25rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                            Dr. {docObj.fullName || 'Doctor'}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {appt.clinicId?.name || 'Assigned Clinic'} • {appt.specialtyId?.name || 'Specialty'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            📅 <strong>{appt.appointmentDate}</strong> | ⏱️ <strong>{slotTime}</strong> | Status:{' '}
                            <span
                              className={`badge ${
                                appt.status === 'BOOKED'
                                  ? 'badge-primary'
                                  : appt.status === 'CHECKED_IN'
                                  ? 'badge-success'
                                  : appt.status === 'CANCELLED'
                                  ? 'badge-secondary'
                                  : 'badge-warning'
                              }`}
                              style={{ marginLeft: '0.35rem' }}
                            >
                              {appt.status}
                            </span>
                          </div>
                          {appt.status === 'BOOKED' && (
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.25rem' }}>
                              Arrival window: 60 mins before to 30 mins after slot start ({appt.timeSlot?.startTime})
                            </div>
                          )}
                          {appt.status === 'CANCELLED' && appt.cancellationReason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                              Reason: {appt.cancellationReason}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {appt.status === 'BOOKED' && (
                            <>
                              <button
                                className="btn btn-primary"
                                disabled={selfCheckInLoading || isCancelling}
                                style={{ fontSize: '0.85rem' }}
                                onClick={() => handleSelfCheckIn(appt._id)}
                              >
                                ✓ Check In Now (Get Token)
                              </button>
                              <button
                                className="btn btn-danger"
                                style={{ fontSize: '0.85rem' }}
                                disabled={isCancelling || selfCheckInLoading}
                                onClick={() => handleCancelAppointment(appt._id)}
                              >
                                {isCancelling ? 'Cancelling...' : 'Cancel'}
                              </button>
                            </>
                          )}
                          {appt.status === 'CHECKED_IN' && (
                            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setViewTab('live_queue')}>
                              View Live Queue →
                            </button>
                          )}
                          {appt.status === 'CANCELLED' && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.85rem' }}
                              onClick={() => {
                                handleProceedToAppointment({
                                  _id: docObj._id || docObj,
                                  fullName: docObj.fullName || 'Doctor',
                                  clinicId: appt.clinicId,
                                  specialtyId: appt.specialtyId,
                                  consultationFee: docObj.consultationFee,
                                  averageConsultationDurationMinutes: docObj.averageConsultationDurationMinutes,
                                });
                              }}
                            >
                              ↺ Rebook Slot
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* VIEW: Patient Live Queue Experience */}
      {viewTab === 'live_queue' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2>🎫 Patient Live Queue Tracker</h2>
          {!liveQueueData || !liveQueueData.hasActiveQueueEntry ? (
            <div className="empty-state">No active queue token for today. Book an appointment or check in at the clinic reception.</div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: '#090d16', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>YOUR QUEUE TOKEN</div>
              <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--primary)', margin: '0.5rem 0' }}>
                #{liveQueueData.tokenNumber}
              </div>
              <div style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                Status: <strong>{liveQueueData.status}</strong> | People Ahead: <strong>{liveQueueData.peopleAhead ?? 0}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated Wait</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>
                    {liveQueueData.estimatedWaitMinutes ?? 0} mins
                  </div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Serving</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#eab308' }}>
                    #{liveQueueData.currentServingToken ?? 'IDLE'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Staff Reception Desk */}
      {viewTab === 'reception' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {/* Reception Header & Clinic Context */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🏥</span> Staff Reception & Operations Desk
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Clinic operational queue orchestration, appointment arrival check-in, and walk-in token allocation.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Clinic: </span>
                <strong style={{ color: 'var(--primary)' }}>
                  {authSession?.user?.profile?.clinicId?.name || (doctors[0]?.clinicId?.name) || 'Assigned Clinic'}
                </strong>
                <span style={{ margin: '0 0.5rem', color: 'var(--border)' }}>|</span>
                <span style={{ color: 'var(--text-muted)' }}>Operator: </span>
                <strong>{authSession?.user?.fullName || 'Staff User'}</strong>
                <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--primary)', color: '#fff' }}>
                  {authSession?.user?.role || 'STAFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Waiting</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.25rem' }}>{waitingEntries.length}</div>
            </div>
            <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Serving / Called</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.25rem' }}>{activeEntries.length}</div>
            </div>
            <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Skipped</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.25rem' }}>{skippedEntries.length}</div>
            </div>
            <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Terminal / Done</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.25rem' }}>{terminalEntries.length}</div>
            </div>
            <div style={{ background: '#090d16', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Today</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e2e8f0', marginTop: '0.25rem' }}>
                {waitingEntries.length + activeEntries.length + skippedEntries.length + terminalEntries.length}
              </div>
            </div>
          </div>

          {/* Operational Message */}
          {receptionMessage && (
            <div style={{ background: '#1c1917', border: '1px solid var(--primary)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-main)', marginBottom: '1rem' }}>
              {receptionMessage}
            </div>
          )}

          {/* Allocated Token Confirmation */}
          {allocatedTokenCard && (
            <div style={{ background: '#064e3b', border: '1px solid var(--success-text)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', textAlign: 'center' }}>
              <h3 style={{ color: '#6ee7b7', margin: 0 }}>✓ QUEUE TOKEN ALLOCATED</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', margin: '0.5rem 0' }}>
                Token #{allocatedTokenCard.tokenNumber}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>
                Priority: {allocatedTokenCard.priority || 'NORMAL'} | Source: {allocatedTokenCard.source || 'STAFF'}
              </div>
              <button className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }} onClick={() => setAllocatedTokenCard(null)}>
                Dismiss
              </button>
            </div>
          )}

          {/* Reception Sub-Tabs Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${receptionSubTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem' }}
              onClick={() => {
                setReceptionSubTab('queue');
                loadTodayStaffQueue();
              }}
            >
              📋 Live Queue Operations
            </button>
            <button
              type="button"
              className={`btn ${receptionSubTab === 'checkin' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem' }}
              onClick={() => {
                setReceptionSubTab('checkin');
                loadStaffAppointments();
              }}
            >
              🎫 Appointment Check-In
            </button>
            <button
              type="button"
              className={`btn ${receptionSubTab === 'walkin' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem' }}
              onClick={() => setReceptionSubTab('walkin')}
            >
              🚶 Walk-In Registration
            </button>
          </div>

          {/* ========================================================================= */}
          {/* SUB-TAB 1: LIVE QUEUE OPERATIONS */}
          {/* ========================================================================= */}
          {receptionSubTab === 'queue' && (
            <div>
              {/* Doctor Queue Paused Alert */}
              {doctorQueueStatus?.isQueuePaused && (
                <div style={{ background: '#451a03', border: '1px solid #f59e0b', color: '#fef3c7', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>⏸ Queue Currently Paused:</strong> {doctorQueueStatus.queuePauseReason || 'Doctor unavailable'}
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }} onClick={handleResumeQueue}>
                    ▶ Resume Queue
                  </button>
                </div>
              )}

              {/* Action & Doctor Focus Bar */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Doctor Queue:</span>
                  <select
                    className="filter-input"
                    style={{ minWidth: '180px' }}
                    value={receptionDoctorId}
                    onChange={(e) => {
                      const newDocId = e.target.value;
                      setReceptionDoctorId(newDocId);
                      loadTodayStaffQueue(newDocId);
                    }}
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>Dr. {d.fullName} ({d.specialtyId?.name || 'Doctor'})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={opLoading || !receptionDoctorId} onClick={handleCallNext}>
                    📢 Call Next Patient
                  </button>
                  <button className="btn btn-secondary" disabled={opLoading || !receptionDoctorId} onClick={handlePauseQueue}>
                    ⏸ Pause Queue
                  </button>
                  <button className="btn btn-secondary" disabled={opLoading || !receptionDoctorId} onClick={handleResumeQueue}>
                    ▶ Resume Queue
                  </button>
                  <button className="btn btn-secondary" onClick={() => loadTodayStaffQueue()}>
                    🔄 Refresh Queue
                  </button>
                </div>
              </div>

              {/* Queue Columns: Serving & Waiting */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Active Serving Card */}
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0 }}>Currently Serving ({activeEntries.length})</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Doctor consultation in Cockpit</span>
                  </div>
                  {activeEntries.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
                      No active patient called. Use "Call Next Patient" to advance the queue.
                    </div>
                  ) : (
                    activeEntries.map((entry) => (
                      <div key={entry._id} style={{ padding: '0.75rem', background: '#0d1322', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.05rem' }}>
                            Token #{entry.tokenNumber}
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: entry.status === 'IN_CONSULTATION' ? '#10b981' : '#38bdf8', color: '#fff' }}>
                            {entry.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '0.35rem' }}>
                          {entry.patientId?.fullName || 'Patient'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Phone: {entry.patientId?.phone || 'N/A'} | Doctor: Dr. {entry.doctorId?.fullName || 'Doctor'}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                            onClick={() => handleSkip(entry._id)}
                            title="Skip patient if absent when called"
                          >
                            ⏭ Skip Patient
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                            onClick={() => handleNoShow(entry._id)}
                            title="Mark patient as No-Show"
                          >
                            🚫 Mark No-Show
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', color: '#ef4444' }}
                            onClick={() => handleStaffCancelQueueEntry(entry._id)}
                            title="Cancel queue entry with reason"
                          >
                            ❌ Cancel Entry
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Waiting Queue List */}
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0 }}>Waiting in Queue ({waitingEntries.length})</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hybrid Priority Sort</span>
                  </div>
                  {waitingEntries.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
                      No patients currently waiting in line.
                    </div>
                  ) : (
                    waitingEntries.map((entry) => (
                      <div key={entry._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                            Token #{entry.tokenNumber} — {entry.patientId?.fullName || 'Patient'}
                            {entry.priority && entry.priority !== 'NORMAL' && (
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: entry.priority === 'EMERGENCY' ? '#dc2626' : '#d97706', color: '#fff' }}>
                                {entry.priority}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Source: {entry.source} | Phone: {entry.patientId?.phone || 'N/A'} {entry.triageReason ? `| Triage: ${entry.triageReason}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', color: '#f59e0b' }}
                            onClick={() => handleOpenTriage(entry)}
                            title="Escalate queue priority"
                          >
                            ⚡ Triage
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', color: '#38bdf8' }}
                            onClick={() => handleOpenTransfer(entry)}
                            title="Transfer patient to another doctor"
                          >
                            🔀 Transfer
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', color: '#ef4444' }}
                            onClick={() => handleStaffCancelQueueEntry(entry._id)}
                            title="Cancel queue entry"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Skipped Patients Recovery Card */}
              {skippedEntries.length > 0 && (
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b' }}>
                    ⏭ Skipped Patients ({skippedEntries.length}) — Ready to Rejoin
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Patients who were absent when called can be rejoined to the waiting queue with a newly allocated token.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {skippedEntries.map((entry) => (
                      <div key={entry._id} style={{ background: '#0d1322', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>Token #{entry.tokenNumber} — {entry.patientId?.fullName || 'Patient'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.skipReason || 'Skipped'}</div>
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => handleStaffRejoinSkipped(entry._id)}
                          disabled={opLoading}
                        >
                          🔁 Rejoin Queue
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Terminal Queue History for Today */}
              {terminalEntries.length > 0 && (
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>
                    🏁 Terminal Queue Entries Today ({terminalEntries.length})
                  </h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.8rem' }}>
                    {terminalEntries.map((entry) => (
                      <div key={entry._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                        <span>Token #{entry.tokenNumber} — {entry.patientId?.fullName || 'Patient'}</span>
                        <span style={{
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: entry.status === 'COMPLETED' ? '#064e3b' : '#334155',
                          color: entry.status === 'COMPLETED' ? '#6ee7b7' : '#94a3b8'
                        }}>
                          {entry.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUB-TAB 2: APPOINTMENT CHECK-IN */}
          {/* ========================================================================= */}
          {receptionSubTab === 'checkin' && (
            <div>
              {/* Check-In Header & Instructions */}
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem' }}>🎫 Clinic Appointment Arrival & Check-In</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Locate booked clinic appointments and check in patients upon clinic arrival. A live queue token is generated and allocated upon check-in.
                </p>
              </div>

              {/* Filter & Search Bar */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Date:</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={staffApptDate}
                    onChange={(e) => {
                      setStaffApptDate(e.target.value);
                      loadStaffAppointments(e.target.value, staffApptStatus);
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Status:</label>
                  <select
                    className="filter-input"
                    value={staffApptStatus}
                    onChange={(e) => {
                      setStaffApptStatus(e.target.value);
                      loadStaffAppointments(staffApptDate, e.target.value);
                    }}
                  >
                    <option value="BOOKED">BOOKED (Awaiting Arrival)</option>
                    <option value="CHECKED_IN">CHECKED_IN (Already in Queue)</option>
                    <option value="ALL">ALL Statuses</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Filter Patient:</label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%' }}
                    placeholder="Search by patient name or phone..."
                    value={staffApptSearch}
                    onChange={(e) => setStaffApptSearch(e.target.value)}
                  />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => loadStaffAppointments()}
                    disabled={staffApptLoading}
                  >
                    {staffApptLoading ? 'Refreshing...' : '🔄 Refresh Appointments'}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {staffApptError && (
                <div style={{ background: '#451a03', border: '1px solid #f59e0b', color: '#fef3c7', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {staffApptError}
                </div>
              )}

              {/* Appointments List */}
              {staffApptLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading clinic appointments...
                </div>
              ) : (() => {
                const filtered = staffAppointments.filter((appt) => {
                  if (!staffApptSearch.trim()) return true;
                  const q = staffApptSearch.toLowerCase();
                  const nameMatch = appt.patientId?.fullName?.toLowerCase().includes(q);
                  const phoneMatch = appt.patientId?.phone?.includes(q);
                  const docMatch = appt.doctorId?.fullName?.toLowerCase().includes(q);
                  return nameMatch || phoneMatch || docMatch;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ background: '#090d16', padding: '2.5rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No appointments matching the selected date and status filters.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
                    {filtered.map((appt) => {
                      const isBooked = appt.status === 'BOOKED';
                      const isCheckedIn = appt.status === 'CHECKED_IN';
                      const isCancelled = appt.status === 'CANCELLED';
                      return (
                        <div
                          key={appt._id}
                          style={{
                            background: '#090d16',
                            border: `1px solid ${isCheckedIn ? '#10b981' : isBooked ? 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8' }}>
                                ⏰ {appt.timeSlot?.startTime || '00:00'} – {appt.timeSlot?.endTime || '00:00'}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  background: isCheckedIn ? '#064e3b' : isBooked ? '#1e3a8a' : '#334155',
                                  color: isCheckedIn ? '#6ee7b7' : isBooked ? '#93c5fd' : '#cbd5e1',
                                  fontWeight: 600,
                                }}
                              >
                                {appt.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                              {appt.patientId?.fullName || 'Patient'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                              Phone: {appt.patientId?.phone || 'N/A'} {appt.patientId?.gender ? `(${appt.patientId.gender})` : ''}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                              Doctor: <strong>Dr. {appt.doctorId?.fullName || 'Doctor'}</strong> ({appt.specialtyId?.name || 'Specialty'})
                            </div>
                          </div>

                          <div style={{ marginTop: '1rem' }}>
                            {isBooked && (
                              <button
                                className="btn btn-primary"
                                style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }}
                                disabled={checkInLoadingId === appt._id}
                                onClick={() => handleStaffCheckIn(appt._id)}
                              >
                                {checkInLoadingId === appt._id ? 'Checking In...' : '🎫 Check In Patient & Allocate Token'}
                              </button>
                            )}
                            {isCheckedIn && (
                              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#10b981', fontWeight: 600, padding: '0.35rem', background: '#064e3b', borderRadius: '4px' }}>
                                ✓ Patient Checked In (In Queue)
                              </div>
                            )}
                            {isCancelled && (
                              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#ef4444', padding: '0.35rem', background: '#450a0a', borderRadius: '4px' }}>
                                Cancelled: {appt.cancellationReason || 'No reason provided'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUB-TAB 3: WALK-IN REGISTRATION */}
          {/* ========================================================================= */}
          {receptionSubTab === 'walkin' && (
            <div>
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem' }}>🚶 Walk-In Patient Registration</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Search for an existing registered patient or create a new walk-in profile, then allocate a queue token directly.
                </p>
              </div>

              {/* Mode Toggle: Existing vs New */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`btn ${!isCreatingNewPatient ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => setIsCreatingNewPatient(false)}
                >
                  🔍 Search Existing Patient
                </button>
                <button
                  type="button"
                  className={`btn ${isCreatingNewPatient ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => setIsCreatingNewPatient(true)}
                >
                  ➕ Register New Patient Profile
                </button>
              </div>

              {/* Mode A: Search Existing Patient */}
              {!isCreatingNewPatient && (
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0' }}>Search Registered Patients</h4>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="filter-input"
                      style={{ flex: 1, minWidth: '220px' }}
                      placeholder="Enter 10-digit phone or patient full name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStaffPatientSearch()}
                    />
                    <button className="btn btn-primary" onClick={handleStaffPatientSearch}>
                      Search Patient
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>Matching Results ({searchResults.length})</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {searchResults.map((p) => (
                          <div
                            key={p._id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.6rem 0.8rem',
                              background: '#0d1322',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div>
                              <strong style={{ color: 'var(--text-main)' }}>{p.fullName}</strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                Phone: {p.phone} | Gender: {p.gender || 'N/A'}
                              </span>
                            </div>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => handleSelectStaffPatient(p)}
                            >
                              Select for Walk-In
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Register New Patient Profile */}
              {isCreatingNewPatient && (
                <form
                  onSubmit={handleCreateWalkInPatient}
                  style={{
                    background: '#090d16',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    marginBottom: '1.25rem',
                    maxWidth: '600px',
                  }}
                >
                  <h4 style={{ margin: '0 0 0.75rem 0' }}>Register New Walk-In Patient Profile</h4>

                  {newPatientError && (
                    <div style={{ background: '#451a03', border: '1px solid #f59e0b', color: '#fef3c7', padding: '0.6rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      {newPatientError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Full Name *</label>
                      <input
                        type="text"
                        className="filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Ramesh Patel"
                        value={newPatientForm.fullName}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>10-Digit Phone *</label>
                      <input
                        type="tel"
                        className="filter-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. 9876543210"
                        value={newPatientForm.phone}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Gender *</label>
                      <select
                        className="filter-input"
                        style={{ width: '100%' }}
                        value={newPatientForm.gender}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, gender: e.target.value })}
                      >
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Date of Birth *</label>
                      <input
                        type="date"
                        className="filter-input"
                        style={{ width: '100%' }}
                        value={newPatientForm.dateOfBirth}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, dateOfBirth: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Street Address / Area</label>
                    <input
                      type="text"
                      className="filter-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. MG Road, Indiranagar"
                      value={newPatientForm.address}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, address: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={newPatientCreating}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {newPatientCreating ? 'Creating Profile...' : '➕ Create Patient Profile'}
                  </button>
                </form>
              )}

              {/* Selected Patient & Token Allocation Card */}
              {selectedStaffPatient && (
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--primary)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, color: '#38bdf8' }}>
                      Selected Patient: {selectedStaffPatient.fullName}
                    </h4>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setSelectedStaffPatient(null)}
                    >
                      Clear / Change
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Phone: {selectedStaffPatient.phone} | Gender: {selectedStaffPatient.gender || 'N/A'} | DOB: {selectedStaffPatient.dateOfBirth?.split('T')[0] || selectedStaffPatient.dateOfBirth || 'N/A'}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Assign Doctor:</label>
                      <select
                        className="filter-input"
                        style={{ width: '100%' }}
                        value={receptionDoctorId}
                        onChange={(e) => setReceptionDoctorId(e.target.value)}
                      >
                        {doctors.map((d) => (
                          <option key={d._id} value={d._id}>Dr. {d.fullName} ({d.specialtyId?.name || 'Doctor'})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button className="btn btn-primary" onClick={handleRegisterWalkInQueue} disabled={!receptionDoctorId}>
                        🚶 Register Walk-In & Allocate Token
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 14 Triage Modal */}
          {triageModalEntry && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#0f172a', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', maxWidth: '440px', width: '90%' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>⚡ Triage Priority Escalation</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Token #{triageModalEntry.tokenNumber} — {triageModalEntry.patientId?.fullName || 'Patient'}
                </p>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Priority Level:</label>
                  <select
                    className="filter-input"
                    style={{ width: '100%' }}
                    value={triagePriority}
                    onChange={(e) => setTriagePriority(e.target.value)}
                  >
                    <option value="NORMAL">NORMAL (Default Sort Weight: 1)</option>
                    <option value="PRIORITY">PRIORITY (Staff Escalated Weight: 2)</option>
                    <option value="EMERGENCY">EMERGENCY (Urgent Weight: 3)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Operational Reason (Non-clinical only, min 5 chars):
                  </label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Elderly mobility assistance requested by triage"
                    value={triageReason}
                    onChange={(e) => setTriageReason(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => setTriageModalEntry(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={triageOpLoading || triageReason.trim().length < 5}
                    onClick={handleSubmitTriage}
                  >
                    {triageOpLoading ? 'Saving...' : 'Apply Priority'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase 14 Doctor Transfer Modal */}
          {transferModalEntry && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#0f172a', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', maxWidth: '440px', width: '90%' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>🔀 Transfer Patient to Doctor</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Token #{transferModalEntry.tokenNumber} — {transferModalEntry.patientId?.fullName || 'Patient'}
                </p>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Target Doctor:</label>
                  <select
                    className="filter-input"
                    style={{ width: '100%' }}
                    value={transferTargetDoctorId}
                    onChange={(e) => setTransferTargetDoctorId(e.target.value)}
                  >
                    <option value="">Select Replacement Doctor...</option>
                    {doctors
                      .filter((d) => d._id !== (transferModalEntry.doctorId?._id || transferModalEntry.doctorId))
                      .map((d) => (
                        <option key={d._id} value={d._id}>Dr. {d.fullName} ({d.specialtyId?.name || 'Doctor'})</option>
                      ))}
                  </select>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Operational Reason (min 5 chars):
                  </label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Doctor called away; transferring waiting queue"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => setTransferModalEntry(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={transferOpLoading || !transferTargetDoctorId || transferReason.trim().length < 5}
                    onClick={handleSubmitTransfer}
                  >
                    {transferOpLoading ? 'Transferring...' : 'Execute Transfer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Day-End Settlement & Reconciliation (Phase 14) */}
      {viewTab === 'settlement' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>🏁 Clinic Day-End Settlement & Reconciliation</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Reconcile active queues, expire unserved patients, auto-generate missing invoices, and close the clinic day.
              </div>
            </div>
            <button className="btn btn-secondary" onClick={loadSettlementPreview}>
              🔄 Refresh Preview
            </button>
          </div>

          {settlementMessage && (
            <div style={{ background: '#1c1917', border: '1px solid var(--primary)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', color: 'var(--text-main)' }}>
              {settlementMessage}
            </div>
          )}

          {settlementPreview ? (
            <div>
              {/* Status Banner */}
              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', background: settlementPreview.isClosed ? '#064e3b' : '#1e293b', border: `1px solid ${settlementPreview.isClosed ? '#10b981' : 'var(--border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong>Settlement Status:</strong> {settlementPreview.isClosed ? '✓ CLINIC DAY CLOSED' : '⏳ OPEN FOR VISITS'} (Date: {settlementPreview.date})
                </div>
                {settlementPreview.isClosed && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>Authoritative daily settlement document recorded</span>
                    {settlementPreview.settlement?._id && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        disabled={exportLoadingId === settlementPreview.settlement._id}
                        onClick={() => handleExportSettlementCSV(settlementPreview.settlement._id)}
                      >
                        {exportLoadingId === settlementPreview.settlement._id ? 'Exporting...' : '📥 Export Settlement CSV'}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      disabled={invoicesExportLoading}
                      onClick={() => handleExportInvoicesCSV(settlementPreview.clinicId || authSession?.user?.staffClinicId, settlementPreview.date)}
                    >
                      {invoicesExportLoading ? 'Exporting...' : '📥 Export Invoices CSV'}
                    </button>
                  </div>
                )}
              </div>

              {/* Metric Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Tokens Issued</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{settlementPreview.summary?.totalTokensIssued || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Online: {settlementPreview.summary?.appointmentCount || 0} | Walk-in: {settlementPreview.summary?.walkInCount || 0}
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed Visits</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{settlementPreview.summary?.completedCount || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Unbilled: {settlementPreview.billing?.unbilledCompletedCount || 0}
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unserved to Expire</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{settlementPreview.unservedCount || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Waiting: {settlementPreview.summary?.waitingCount || 0} | Skipped: {settlementPreview.summary?.skippedCount || 0}
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Consultations</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: settlementPreview.hasActiveConsultations ? '#f59e0b' : '#10b981' }}>
                    {settlementPreview.summary?.inConsultationCount || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {settlementPreview.hasActiveConsultations ? '⚠️ Must finish before closure' : '✓ No rooms active'}
                  </div>
                </div>
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Invoiced</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>₹{settlementPreview.billing?.totalInvoiced || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Collected: ₹{settlementPreview.billing?.totalCollected || 0}
                  </div>
                </div>
              </div>

              {/* Active Consultations Warning if any */}
              {settlementPreview.hasActiveConsultations && (
                <div style={{ background: '#451a03', border: '1px solid #f59e0b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <h4 style={{ color: '#fbbf24', margin: '0 0 0.5rem 0' }}>⚠️ Active Consultations In Progress</h4>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    Consultation rooms currently active. Please complete visits before closure or enable force closure:
                  </p>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                    {settlementPreview.activeConsultations?.map((ac) => (
                      <li key={ac._id}>Token #{ac.tokenNumber} with Dr. {ac.doctorName} (Patient: {ac.patientName})</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Close Day Action Form (if not closed) */}
              {!settlementPreview.isClosed && (
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Finalize & Close Clinic Day</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Closing will expire all {settlementPreview.unservedCount || 0} remaining unserved entries, auto-generate invoices for unbilled visits, and record the daily settlement audit ledger.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px' }}>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Optional settlement notes (e.g. Normal clinic closure by reception desk)..."
                      value={settlementNotes}
                      onChange={(e) => setSettlementNotes(e.target.value)}
                    />
                    {settlementPreview.hasActiveConsultations && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#f59e0b' }}>
                        <input
                          type="checkbox"
                          checked={settlementForce}
                          onChange={(e) => setSettlementForce(e.target.checked)}
                        />
                        Force closure despite active consultations
                      </label>
                    )}
                    <button
                      className="btn btn-primary"
                      disabled={settlementLoading || (settlementPreview.hasActiveConsultations && !settlementForce)}
                      onClick={handleCloseClinicDay}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {settlementLoading ? 'Finalizing Day...' : '🔒 Finalize & Close Clinic Day'}
                    </button>
                  </div>
                </div>
              )}

              {/* Settlement History Section */}
              <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>📜 Settlement History</h4>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={loadSettlementHistory}>
                    Load Past Closures
                  </button>
                </div>
                {settlementHistory.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Click &quot;Load Past Closures&quot; to view settlement audit history.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {settlementHistory.map((s) => (
                      <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#020617', borderRadius: '6px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong>{s.date}</strong> — Status: <span style={{ color: '#10b981' }}>{s.status}</span>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Closed by: {s.closedBy?.name || 'Staff'} at {new Date(s.closedAt).toLocaleTimeString()} {s.notes ? `| Note: ${s.notes}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          <div>Tokens: {s.metrics?.totalTokensIssued || 0} | Served: {s.metrics?.completedVisits || 0} | Expired: {s.metrics?.expiredVisits || 0}</div>
                          <div style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Revenue Collected: ₹{s.metrics?.totalRevenueCollected || 0}</div>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            disabled={exportLoadingId === s._id}
                            onClick={() => handleExportSettlementCSV(s._id)}
                          >
                            {exportLoadingId === s._id ? 'Exporting...' : '📥 Export CSV'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">Loading settlement preview...</div>
          )}
        </div>
      )}

      {/* VIEW: Billing & Invoices */}
      {viewTab === 'billing' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2>💳 Invoices & Payments</h2>
          {currentRole === 'PATIENT' ? (
            <div>
              <h3>My Invoices</h3>
              {patientInvoices.length === 0 ? (
                <div className="empty-state">No invoices issued.</div>
              ) : (
                patientInvoices.map((inv) => (
                  <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090d16', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{inv.invoiceNumber}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Total Amount: ₹{inv.totalAmount} | Status: <strong style={{ color: inv.status === 'PAID' ? 'var(--primary)' : '#eab308' }}>{inv.status}</strong>
                      </div>
                    </div>
                    {inv.status === 'UNPAID' && (
                      <button className="btn btn-primary" onClick={() => handlePayInvoice(inv._id)}>
                        Pay ₹{inv.totalAmount}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)' }}>Staff Billing & Refund console is accessible using staff credentials.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Public Queue Display Board */}
      {viewTab === 'public_display' && (
        <div className="card" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--status-success)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                <span className="status-dot-pulse" />
                <span>Live broadcast kiosk</span>
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Waiting Room Public Display
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                HIPAA/privacy-compliant real-time queue tracker for clinic waiting room monitors
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input
                type="text"
                className="filter-input"
                placeholder="Enter Clinic ID..."
                value={publicClinicId}
                onChange={(e) => setPublicClinicId(e.target.value)}
                style={{ minWidth: '240px' }}
              />
              <button className="btn btn-primary" onClick={loadPublicDisplay}>
                Connect Feed
              </button>
            </div>
          </div>

          {publicDisplayData ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Active Clinic Station</span>
                <h3 style={{ fontSize: '1.8rem', color: 'var(--primary-light)', margin: '0.25rem 0 0 0', fontWeight: 700 }}>
                  {publicDisplayData.clinicName || 'Clinic Public Display'}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Now Serving Card */}
                <div style={{ background: 'var(--surface-ground)', border: '2px solid rgba(14, 165, 233, 0.4)', borderRadius: 'var(--radius-xl)', padding: '2rem', textAlign: 'center', boxShadow: '0 0 30px -5px rgba(14, 165, 233, 0.2)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-light)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                    <IconPulse />
                    <span>Now Serving</span>
                  </div>
                  <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0.5rem 0', textShadow: '0 0 30px rgba(56, 189, 248, 0.4)' }}>
                    #{publicDisplayData.currentServingToken || 'IDLE'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {publicDisplayData.currentServingToken ? 'Please proceed to designated exam room' : 'Exam rooms currently preparing'}
                  </div>
                </div>

                {/* Total Waiting Card */}
                <div style={{ background: 'var(--surface-ground)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                    <IconClock />
                    <span>Waiting in Queue</span>
                  </div>
                  <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#fbbf24', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0.5rem 0' }}>
                    {publicDisplayData.totalWaiting || 0}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Patients currently checked in today
                  </div>
                </div>
              </div>

              {/* Kiosk Footer Notice */}
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <IconShield />
                <span>Patient names are strictly masked to ensure compliance with medical confidentiality standards. Check token on your mobile pass.</span>
              </div>
            </div>
          ) : (
            <div className="empty-state-card" style={{ margin: '1rem auto' }}>
              <div className="empty-state-icon">
                <IconActivity />
              </div>
              <div className="empty-state-title">Display Feed Not Connected</div>
              <div className="empty-state-desc">
                Enter your Clinic ID above and click "Connect Feed" to stream live token numbers to this display.
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Analytics & Intelligence */}
      {viewTab === 'intelligence' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2>🧠 Phase 12 — Queue Intelligence & Operational AI</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Predictive machine learning models for wait times, consultation durations, congestion forecasts, and operational anomaly detection.
            <strong> Note: ML predictions are advisory only and never alter queue ordering.</strong>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4>Patient Wait Prediction</h4>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={async () => {
                if (!patientToken) return alert('Please sign in as Patient');
                const res = await fetchPatientQueuePrediction(patientToken);
                alert(`Prediction: ${res.data?.data?.estimatedWaitMinutes} mins (Confidence: ${res.data?.data?.confidence})`);
              }}>
                Fetch Live AI Wait Time
              </button>
            </div>
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4>Staff Congestion Intelligence</h4>
              <button className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={async () => {
                const token = staffToken || adminToken;
                if (!token) return alert('Please sign in as Staff/Admin');
                const res = await fetchStaffQueueIntelligence(token);
                alert(`Congestion: ${res.data?.data?.congestionLevel} | Active Queue: ${res.data?.data?.activeQueueCount}`);
              }}>
                Fetch Clinic Congestion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Admin Governance & Operational Audit (Phase 15) */}
      {viewTab === 'governance' && currentRole === 'ADMIN' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>🛡️ Administrative Governance & Operational Audit</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Configure clinic operational policies, inspect immutable queue audit logs, and review financial reconciliations.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className={`btn ${adminSubTab === 'policy' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => setAdminSubTab('policy')}
              >
                ⚙️ Clinic Policy
              </button>
              <button
                className={`btn ${adminSubTab === 'queue_audit' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => setAdminSubTab('queue_audit')}
              >
                📜 Queue Audit Trail
              </button>
              <button
                className={`btn ${adminSubTab === 'financial_audit' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => setAdminSubTab('financial_audit')}
              >
                💰 Financial Audit
              </button>
              <button
                className={`btn ${adminSubTab === 'schedules' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => setAdminSubTab('schedules')}
              >
                📅 Doctor Schedules
              </button>
              <button
                className={`btn ${adminSubTab === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  setAdminSubTab('roster');
                  loadAdminRosterData();
                }}
              >
                👥 Roster & Setup Health
              </button>
            </div>
          </div>

          {/* Clinic Selector / Context */}
          <div style={{ background: '#090d16', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Clinic ID:</span>
            <input
              type="text"
              className="filter-input"
              style={{ maxWidth: '320px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
              placeholder="Enter or paste Clinic ObjectId..."
              value={governanceClinicId}
              onChange={(e) => setGovernanceClinicId(e.target.value)}
            />
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={() => {
                if (adminSubTab === 'policy') loadClinicPolicy(governanceClinicId);
                if (adminSubTab === 'queue_audit') loadQueueAuditLogs(1);
                if (adminSubTab === 'financial_audit') loadFinancialAuditLogs(1);
                if (adminSubTab === 'schedules') loadAdminDoctors();
                if (adminSubTab === 'roster') loadAdminRosterData();
              }}
            >
              🔄 Refresh Data
            </button>
          </div>

          {/* SUB-TAB 1: Clinic Operational Policy */}
          {adminSubTab === 'policy' && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>⚙️ Clinic Operational & Arrival Policies</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Tune patient arrival windows and settlement lifecycle parameters. Changes take effect immediately on incoming self-check-ins.
              </p>

              {policyMessage && (
                <div style={{ background: policyMessage.includes('✓') ? '#064e3b' : '#451a03', border: `1px solid ${policyMessage.includes('✓') ? '#10b981' : '#f59e0b'}`, padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {policyMessage}
                </div>
              )}

              <form onSubmit={handleSaveClinicPolicy} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Self-Check-In Lead Window (Minutes Before Slot):
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    className="filter-input"
                    value={clinicPolicyForm.selfCheckInLeadMinutes}
                    onChange={(e) => setClinicPolicyForm({ ...clinicPolicyForm, selfCheckInLeadMinutes: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Allowed range: 15–180 minutes. Default: 60 minutes.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Self-Check-In Grace Period (Minutes After Slot):
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    className="filter-input"
                    value={clinicPolicyForm.selfCheckInGraceMinutes}
                    onChange={(e) => setClinicPolicyForm({ ...clinicPolicyForm, selfCheckInGraceMinutes: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Allowed range: 5–120 minutes. Default: 30 minutes.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={clinicPolicyForm.autoExpireOnSettlement}
                      onChange={(e) => setClinicPolicyForm({ ...clinicPolicyForm, autoExpireOnSettlement: e.target.checked })}
                    />
                    <strong>Auto-expire unserved entries during day-end closure</strong>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.5rem', display: 'block' }}>
                    When enabled, closing the clinic day transitions waiting and skipped entries to EXPIRED status.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Queue Policy Metadata:
                  </label>
                  <select
                    className="filter-input"
                    value={clinicPolicyForm.queuePolicy}
                    onChange={(e) => setClinicPolicyForm({ ...clinicPolicyForm, queuePolicy: e.target.value })}
                  >
                    <option value="HYBRID">HYBRID (Phase 08 Deterministic Comparator — Authoritative)</option>
                    <option value="FIFO">FIFO (Config Metadata)</option>
                    <option value="APPOINTMENT_PRIORITY">APPOINTMENT_PRIORITY (Config Metadata)</option>
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Note: Queue engine ordering remains authoritative and frozen per Phase 08 specification.
                  </span>
                </div>

                <button type="submit" className="btn btn-primary" disabled={policyLoading} style={{ alignSelf: 'flex-start' }}>
                  {policyLoading ? 'Saving Policy...' : '💾 Save Policy Settings'}
                </button>
              </form>
            </div>
          )}

          {/* SUB-TAB 2: Queue Audit Trail */}
          {adminSubTab === 'queue_audit' && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📜 Operational Queue Audit Ledger</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Immutable append-only record of all check-ins, triages, transfers, skips, and day-end expirations.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className="filter-input"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                    value={queueAuditAction}
                    onChange={(e) => setQueueAuditAction(e.target.value)}
                  >
                    <option value="">All Action Types</option>
                    <option value="SELF_CHECK_IN">SELF_CHECK_IN</option>
                    <option value="TRIAGE_ESCALATION">TRIAGE_ESCALATION</option>
                    <option value="QUEUE_TRANSFER">QUEUE_TRANSFER</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="DAY_END_EXPIRED">DAY_END_EXPIRED</option>
                    <option value="CHECK_IN">CHECK_IN (Walk-in)</option>
                    <option value="CALL_NEXT">CALL_NEXT</option>
                    <option value="START_CONSULTATION">START_CONSULTATION</option>
                    <option value="COMPLETE">COMPLETE</option>
                    <option value="SKIP">SKIP</option>
                    <option value="NO_SHOW">NO_SHOW</option>
                    <option value="CANCEL">CANCEL</option>
                    <option value="REJOIN">REJOIN</option>
                    <option value="PAUSE_QUEUE">PAUSE_QUEUE</option>
                    <option value="RESUME_QUEUE">RESUME_QUEUE</option>
                  </select>
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => loadQueueAuditLogs(1)}>
                    Filter
                  </button>
                </div>
              </div>

              {queueAuditLoading ? (
                <div className="empty-state">Loading queue audit records...</div>
              ) : queueAuditLogs.length === 0 ? (
                <div className="empty-state">No queue audit history matches the criteria.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem' }}>Timestamp</th>
                        <th style={{ padding: '0.5rem' }}>Action</th>
                        <th style={{ padding: '0.5rem' }}>Token</th>
                        <th style={{ padding: '0.5rem' }}>Doctor</th>
                        <th style={{ padding: '0.5rem' }}>Actor</th>
                        <th style={{ padding: '0.5rem' }}>Details / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueAuditLogs.map((log) => {
                        let badgeColor = '#64748b';
                        if (log.action === 'SELF_CHECK_IN') badgeColor = '#10b981';
                        if (log.action === 'TRIAGE_ESCALATION') badgeColor = '#f59e0b';
                        if (log.action === 'QUEUE_TRANSFER') badgeColor = '#3b82f6';
                        if (log.action === 'EXPIRED' || log.action === 'DAY_END_EXPIRED') badgeColor = '#ef4444';
                        if (log.action === 'COMPLETE') badgeColor = '#059669';

                        return (
                          <tr key={log._id} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{ background: badgeColor, color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold' }}>
                              {log.queueEntryId?.tokenNumber ? `#${log.queueEntryId.tokenNumber}` : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {log.doctorId?.fullName || 'Doctor'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <div>{log.userRole}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.performedBy?.email || 'System'}</div>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>
                              {log.reason || `${log.previousState || 'NONE'} ➔ ${log.newState}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Showing {queueAuditLogs.length} of {queueAuditTotal} entries (Page {queueAuditPage})</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        disabled={queueAuditPage <= 1}
                        onClick={() => loadQueueAuditLogs(queueAuditPage - 1)}
                      >
                        ◀ Previous
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        disabled={queueAuditLogs.length < 25}
                        onClick={() => loadQueueAuditLogs(queueAuditPage + 1)}
                      >
                        Next ▶
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 4: Doctor Schedule & Consultation Management */}
          {adminSubTab === 'schedules' && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem' }}>📅 Doctor Schedules & Consultation Duration Management</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Inspect and configure weekly recurring working days, shift intervals, breaks, and consultation slot durations across all clinic doctors.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Doctors: <strong>{adminDoctors.length}</strong> ({adminDoctors.filter((d) => d.hasSchedule).length} configured, {adminDoctors.filter((d) => !d.hasSchedule).length} unconfigured)
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    onClick={loadAdminDoctors}
                    disabled={adminDoctorsLoading}
                  >
                    {adminDoctorsLoading ? 'Refreshing...' : '🔄 Refresh Roster'}
                  </button>
                </div>
              </div>

              {adminDoctorsError && (
                <div style={{ background: '#451a03', border: '1px solid #f59e0b', color: '#fef3c7', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ⚠️ {adminDoctorsError}
                </div>
              )}

              <div className="admin-schedules-grid">
                {/* Left Panel: Doctor Roster */}
                <div className="admin-schedules-sidebar">
                  <div style={{ marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Search doctor, clinic, specialty..."
                      value={adminDoctorSearch}
                      onChange={(e) => setAdminDoctorSearch(e.target.value)}
                      style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                    />
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className={`btn btn-xs ${adminScheduleFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setAdminScheduleFilter('ALL')}
                    >
                      All ({adminDoctors.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${adminScheduleFilter === 'CONFIGURED' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setAdminScheduleFilter('CONFIGURED')}
                    >
                      Configured ({adminDoctors.filter((d) => d.hasSchedule).length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${adminScheduleFilter === 'UNCONFIGURED' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setAdminScheduleFilter('UNCONFIGURED')}
                    >
                      Unconfigured ({adminDoctors.filter((d) => !d.hasSchedule).length})
                    </button>
                  </div>

                  {/* Doctor List */}
                  {adminDoctorsLoading && adminDoctors.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>Loading doctors...</div>
                  ) : filteredAdminDoctors.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>No doctors found matching filters.</div>
                  ) : (
                    <div className="admin-doctor-roster-list">
                      {filteredAdminDoctors.map((doc) => {
                        const isSelected = selectedAdminDoctor?._id === doc._id;
                        const isClinicActive = doc.clinicId?.isActive !== false;
                        const isDoctorActive = doc.isActive !== false;

                        return (
                          <div
                            key={doc._id}
                            className={`admin-doctor-roster-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => initScheduleForDoctor(doc)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--primary-light)' : 'var(--text-main)' }}>
                                Dr. {doc.fullName}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                {!isDoctorActive && (
                                  <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                    Inactive Doc
                                  </span>
                                )}
                                {!isClinicActive && (
                                  <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                    Clinic Inactive
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                              {doc.specialtyId?.name || 'Specialist'} • <strong>{doc.clinicId?.name || 'Clinic'}</strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                              {doc.hasSchedule && doc.workingDays?.length > 0 ? (
                                <span style={{ color: 'var(--status-success)', fontWeight: 500 }}>
                                  🗓️ {formatWorkingDays(doc.workingDays)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                  ⚠️ Not Configured
                                </span>
                              )}
                              <span style={{ color: 'var(--text-muted)' }}>
                                ⏱️ {doc.averageConsultationDurationMinutes || 15}m
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Panel: Schedule Editor */}
                <div className="admin-schedules-editor">
                  {!selectedAdminDoctor ? (
                    <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                      Select a doctor from the roster on the left to inspect or configure their weekly schedule.
                    </div>
                  ) : (
                    <div>
                      {/* Doctor Overview Banner */}
                      <div className="admin-doc-editor-header">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>
                              Dr. {selectedAdminDoctor.fullName}
                            </h4>
                            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                              {selectedAdminDoctor.specialtyId?.name || 'General'}
                            </span>
                            {selectedAdminDoctor.isActive !== false ? (
                              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Doctor Active</span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>Doctor Inactive</span>
                            )}
                            {selectedAdminDoctor.clinicId?.isActive !== false ? (
                              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Clinic Active</span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Clinic Inactive</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Clinic: <strong>{selectedAdminDoctor.clinicId?.name || 'N/A'}</strong> ({selectedAdminDoctor.clinicId?.city || 'City'}) • Fee: ₹{selectedAdminDoctor.consultationFee || 0}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                              Consultation Duration
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <input
                                type="number"
                                min="1"
                                max="240"
                                className="filter-input"
                                value={scheduleDuration}
                                onChange={(e) => setScheduleDuration(e.target.value)}
                                style={{ width: '80px', textAlign: 'center', padding: '0.3rem 0.5rem', fontWeight: 600 }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>min</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Warnings if Doctor or Clinic Inactive */}
                      {selectedAdminDoctor.clinicId?.isActive === false && (
                        <div style={{ background: '#451a03', border: '1px solid #f59e0b', color: '#fef3c7', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                          ⚠️ <strong>Notice:</strong> The associated clinic <em>{selectedAdminDoctor.clinicId?.name}</em> is marked INACTIVE. Schedule changes will be saved to the database, but patients cannot book appointments while the clinic is inactive.
                        </div>
                      )}
                      {selectedAdminDoctor.isActive === false && (
                        <div style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fee2e2', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                          ⚠️ <strong>Notice:</strong> This doctor record is marked INACTIVE. The doctor will not appear in patient discovery searches until activated.
                        </div>
                      )}

                      {/* Quick Schedule Helpers */}
                      <div className="admin-schedule-presets-bar">
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Quick Presets:
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                          onClick={handleApplyMonToFriPreset}
                          title="Set Mon-Fri 09:00-13:00 and 16:00-20:00"
                        >
                          ⚡ Mon–Fri (Two Shifts: 9-1, 4-8)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                          onClick={handleApplySingleShiftPreset}
                          title="Set Mon-Sat 09:00-17:00 with 1h Lunch Break"
                        >
                          ⚡ Mon–Sat (9-5 + Lunch)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', color: 'var(--status-danger)' }}
                          onClick={handleMarkAllOffDuty}
                          title="Set all days to off-duty"
                        >
                          🚫 Mark All Off-Duty
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                          onClick={handleResetSchedule}
                          title="Discard unsaved changes and reload doctor's schedule"
                        >
                          ↺ Reset Changes
                        </button>
                      </div>

                      {/* 7-Day Schedule Editor List */}
                      <div className="admin-schedule-days-list">
                        {scheduleWeeklyHours.map((dayObj, dayIdx) => (
                          <div
                            key={dayObj.dayOfWeek}
                            className={`admin-schedule-day-card ${dayObj.isWorkingDay ? 'day-active' : 'day-inactive'}`}
                          >
                            <div className="day-card-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <label className="day-toggle-label">
                                  <input
                                    type="checkbox"
                                    checked={dayObj.isWorkingDay}
                                    onChange={() => handleToggleWorkingDay(dayIdx)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                  />
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: dayObj.isWorkingDay ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                    {dayObj.dayOfWeek}
                                  </span>
                                </label>
                                {dayObj.isWorkingDay ? (
                                  <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                                    Working ({dayObj.shifts?.length || 0} shift{dayObj.shifts?.length === 1 ? '' : 's'})
                                  </span>
                                ) : (
                                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', opacity: 0.7 }}>
                                    Off-Duty
                                  </span>
                                )}
                              </div>
                              {dayObj.isWorkingDay && (
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                    onClick={() => handleAddShift(dayIdx)}
                                  >
                                    + Add Shift
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                    onClick={() => handleAddBreak(dayIdx)}
                                  >
                                    + Add Break
                                  </button>
                                </div>
                              )}
                            </div>

                            {dayObj.isWorkingDay ? (
                              <div className="day-card-body">
                                {/* Shifts */}
                                <div style={{ marginBottom: dayObj.breaks?.length > 0 ? '0.75rem' : '0' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                    Working Shifts:
                                  </div>
                                  {(!dayObj.shifts || dayObj.shifts.length === 0) ? (
                                    <div style={{ color: 'var(--status-danger)', fontSize: '0.78rem', fontStyle: 'italic', marginBottom: '0.35rem' }}>
                                      ⚠️ At least one shift is required for working days. Click "+ Add Shift".
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {dayObj.shifts.map((shift, sIdx) => (
                                        <div key={sIdx} className="shift-interval-row">
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '55px' }}>
                                            Shift {sIdx + 1}:
                                          </span>
                                          <input
                                            type="time"
                                            className="filter-input time-input"
                                            value={shift.startTime}
                                            onChange={(e) => handleShiftChange(dayIdx, sIdx, 'startTime', e.target.value)}
                                            required
                                          />
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
                                          <input
                                            type="time"
                                            className="filter-input time-input"
                                            value={shift.endTime}
                                            onChange={(e) => handleShiftChange(dayIdx, sIdx, 'endTime', e.target.value)}
                                            required
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-danger-subtle"
                                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem' }}
                                            onClick={() => handleRemoveShift(dayIdx, sIdx)}
                                            title="Remove Shift"
                                          >
                                            ✕ Remove
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Breaks */}
                                {dayObj.breaks && dayObj.breaks.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                      Breaks:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {dayObj.breaks.map((brk, bIdx) => (
                                        <div key={bIdx} className="break-interval-row">
                                          <input
                                            type="text"
                                            className="filter-input"
                                            placeholder="Label (e.g. Lunch)"
                                            value={brk.label || ''}
                                            onChange={(e) => handleBreakChange(dayIdx, bIdx, 'label', e.target.value)}
                                            style={{ width: '110px', fontSize: '0.78rem', padding: '0.25rem 0.45rem' }}
                                          />
                                          <input
                                            type="time"
                                            className="filter-input time-input"
                                            value={brk.startTime}
                                            onChange={(e) => handleBreakChange(dayIdx, bIdx, 'startTime', e.target.value)}
                                            required
                                          />
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
                                          <input
                                            type="time"
                                            className="filter-input time-input"
                                            value={brk.endTime}
                                            onChange={(e) => handleBreakChange(dayIdx, bIdx, 'endTime', e.target.value)}
                                            required
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-danger-subtle"
                                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem' }}
                                            onClick={() => handleRemoveBreak(dayIdx, bIdx)}
                                            title="Remove Break"
                                          >
                                            ✕ Remove
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0.4rem 0 0.2rem 0' }}>
                                Doctor off-duty on {dayObj.dayOfWeek}. No consultation slots generated.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Notification Message */}
                      {scheduleMessage && (
                        <div
                          style={{
                            background: scheduleMessage.type === 'success' ? '#064e3b' : '#451a03',
                            border: `1px solid ${scheduleMessage.type === 'success' ? '#10b981' : '#f59e0b'}`,
                            color: scheduleMessage.type === 'success' ? '#a7f3d0' : '#fef3c7',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            marginTop: '1rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          {scheduleMessage.text}
                        </div>
                      )}

                      {/* Save Action Bar */}
                      <div className="admin-schedule-footer-bar">
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '0.55rem 1.35rem', fontWeight: 600, fontSize: '0.9rem' }}
                          onClick={handleSaveSchedule}
                          disabled={scheduleSaving}
                        >
                          {scheduleSaving ? '💾 Saving Schedule...' : `💾 Save Schedule for Dr. ${selectedAdminDoctor.fullName}`}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                          onClick={handleResetSchedule}
                          disabled={scheduleSaving}
                        >
                          Discard Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: Financial Audit Trail */}
          {adminSubTab === 'financial_audit' && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>💰 Financial & Payment Audit Trail</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Immutable ledger of all invoice issues, payment settlements, and refund events.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className="filter-input"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                    value={financialAuditAction}
                    onChange={(e) => setFinancialAuditAction(e.target.value)}
                  >
                    <option value="">All Financial Events</option>
                    <option value="INVOICE_CREATED">INVOICE_CREATED</option>
                    <option value="INVOICE_ISSUED">INVOICE_ISSUED</option>
                    <option value="PAYMENT_INITIATED">PAYMENT_INITIATED</option>
                    <option value="PAYMENT_SUCCESS">PAYMENT_SUCCESS</option>
                    <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
                    <option value="REFUND_INITIATED">REFUND_INITIATED</option>
                    <option value="REFUND_COMPLETED">REFUND_COMPLETED</option>
                    <option value="INVOICE_CANCELLED">INVOICE_CANCELLED</option>
                  </select>
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => loadFinancialAuditLogs(1)}>
                    Filter
                  </button>
                </div>
              </div>

              {financialAuditLoading ? (
                <div className="empty-state">Loading financial audit records...</div>
              ) : financialAuditLogs.length === 0 ? (
                <div className="empty-state">No financial audit records match the criteria.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem' }}>Timestamp</th>
                        <th style={{ padding: '0.5rem' }}>Action</th>
                        <th style={{ padding: '0.5rem' }}>Amount</th>
                        <th style={{ padding: '0.5rem' }}>Actor</th>
                        <th style={{ padding: '0.5rem' }}>Reference</th>
                        <th style={{ padding: '0.5rem' }}>Reason / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialAuditLogs.map((fLog) => (
                        <tr key={fLog._id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            {new Date(fLog.timestamp).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <span style={{ background: fLog.action.includes('SUCCESS') ? '#059669' : fLog.action.includes('REFUND') ? '#d97706' : '#475569', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {fLog.action}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            ₹{fLog.amount ?? 0}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <div>{fLog.actorRole}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fLog.performedBy?.email || 'User'}</div>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {fLog.transactionReference || 'N/A'}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>
                            {fLog.reason || `${fLog.previousStatus || 'NONE'} ➔ ${fLog.newStatus}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Showing {financialAuditLogs.length} of {financialAuditTotal} entries (Page {financialAuditPage})</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        disabled={financialAuditPage <= 1}
                        onClick={() => loadFinancialAuditLogs(financialAuditPage - 1)}
                      >
                        ◀ Previous
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        disabled={financialAuditLogs.length < 25}
                        onClick={() => loadFinancialAuditLogs(financialAuditPage + 1)}
                      >
                        Next ▶
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 5: Operational Roster & Setup Health Inspector */}
          {adminSubTab === 'roster' && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem' }}>👥 Operational Roster & Setup Health Inspector</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Inspect clinic readiness, doctor schedule coverage, staff clinic assignments, and active/inactive operational status across the platform.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={loadAdminRosterData}
                  disabled={adminClinicsLoading || adminStaffLoading || adminDoctorsLoading}
                >
                  {adminClinicsLoading || adminStaffLoading || adminDoctorsLoading ? 'Refreshing...' : '🔄 Refresh Roster'}
                </button>
              </div>

              {/* Health Inspector Summary Cards */}
              {(() => {
                const inactiveClinics = adminClinics.filter((c) => !c.isActive).length;
                const inactiveDoctors = adminDoctors.filter((d) => !d.isActive).length;
                const unscheduledDoctors = adminDoctors.filter((d) => !d.hasSchedule).length;
                const inactiveStaff = adminStaffList.filter((s) => s.userId?.isActive === false || s.isActive === false).length;
                const clinicsWithoutStaff = adminClinics.filter((c) => !adminStaffList.some((s) => (s.clinicId?._id || s.clinicId)?.toString() === c._id?.toString())).length;
                const hasIssues = inactiveClinics > 0 || inactiveDoctors > 0 || unscheduledDoctors > 0 || clinicsWithoutStaff > 0;

                return (
                  <div>
                    {hasIssues && (
                      <div style={{ background: '#451a03', border: '1px solid #f59e0b', color: '#fef3c7', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                        <strong>⚠️ Operational Setup Notice:</strong> QFlow detected {unscheduledDoctors > 0 ? `${unscheduledDoctors} doctor(s) without schedules, ` : ''}{clinicsWithoutStaff > 0 ? `${clinicsWithoutStaff} clinic(s) without staff, ` : ''}{inactiveClinics > 0 ? `${inactiveClinics} inactive clinic(s), ` : ''}{inactiveDoctors > 0 ? `${inactiveDoctors} inactive doctor(s).` : ''} Review below to ensure smooth reception operations.
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: '#0d1322', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clinics</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>{adminClinics.length}</div>
                        <div style={{ fontSize: '0.72rem', color: inactiveClinics > 0 ? '#f59e0b' : '#10b981', marginTop: '0.2rem' }}>
                          {inactiveClinics > 0 ? `${inactiveClinics} Inactive` : '✓ All Active'}
                        </div>
                      </div>

                      <div style={{ background: '#0d1322', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doctors</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.2rem' }}>{adminDoctors.length}</div>
                        <div style={{ fontSize: '0.72rem', color: unscheduledDoctors > 0 ? '#f59e0b' : '#10b981', marginTop: '0.2rem' }}>
                          {unscheduledDoctors > 0 ? `${unscheduledDoctors} Unscheduled` : '✓ All Scheduled'}
                        </div>
                      </div>

                      <div style={{ background: '#0d1322', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Staff Members</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.2rem' }}>{adminStaffList.length}</div>
                        <div style={{ fontSize: '0.72rem', color: inactiveStaff > 0 ? '#f59e0b' : '#10b981', marginTop: '0.2rem' }}>
                          {inactiveStaff > 0 ? `${inactiveStaff} Inactive` : '✓ All Active'}
                        </div>
                      </div>

                      <div style={{ background: '#0d1322', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unstaffed Clinics</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: clinicsWithoutStaff > 0 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
                          {clinicsWithoutStaff}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {clinicsWithoutStaff > 0 ? 'Needs Staff Assignment' : '✓ Full Coverage'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Filter & Search Bar */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className={`btn ${adminRosterFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    onClick={() => setAdminRosterFilter('ALL')}
                  >
                    All ({adminClinics.length + adminDoctors.length + adminStaffList.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${adminRosterFilter === 'CLINICS' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    onClick={() => setAdminRosterFilter('CLINICS')}
                  >
                    Clinics ({adminClinics.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${adminRosterFilter === 'DOCTORS' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    onClick={() => setAdminRosterFilter('DOCTORS')}
                  >
                    Doctors ({adminDoctors.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${adminRosterFilter === 'STAFF' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    onClick={() => setAdminRosterFilter('STAFF')}
                  >
                    Staff ({adminStaffList.length})
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    placeholder="Search by name, code, email, or clinic..."
                    value={adminRosterSearch}
                    onChange={(e) => setAdminRosterSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Roster Listings */}
              {(adminClinicsLoading || adminStaffLoading || adminDoctorsLoading) ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading operational roster data...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* CLINICS SECTION */}
                  {(adminRosterFilter === 'ALL' || adminRosterFilter === 'CLINICS') && (
                    <div>
                      <h4 style={{ margin: '0 0 0.6rem 0', color: '#38bdf8', fontSize: '0.95rem' }}>
                        🏥 Clinics ({adminClinics.length})
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '0.75rem' }}>
                        {adminClinics
                          .filter((c) => {
                            if (!adminRosterSearch.trim()) return true;
                            const q = adminRosterSearch.toLowerCase();
                            return c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) || c.address?.city?.toLowerCase().includes(q);
                          })
                          .map((clinic) => {
                            const clinicStaff = adminStaffList.filter((s) => (s.clinicId?._id || s.clinicId)?.toString() === clinic._id?.toString());
                            const clinicDocs = adminDoctors.filter((d) => (d.clinicId?._id || d.clinicId)?.toString() === clinic._id?.toString());
                            return (
                              <div
                                key={clinic._id}
                                style={{
                                  background: '#0d1322',
                                  border: `1px solid ${clinic.isActive ? 'var(--border)' : '#7f1d1d'}`,
                                  borderRadius: '6px',
                                  padding: '0.85rem',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{clinic.name}</strong>
                                  <span
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.12rem 0.35rem',
                                      borderRadius: '4px',
                                      background: clinic.isActive ? '#064e3b' : '#450a0a',
                                      color: clinic.isActive ? '#6ee7b7' : '#fca5a5',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {clinic.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                  Code: <strong>{clinic.code || 'N/A'}</strong> | {clinic.address?.city || 'City'}, {clinic.address?.state || 'State'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                  Phone: {clinic.phone || 'N/A'} | Policy: {clinic.queuePolicy || 'HYBRID'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Doctors: <strong>{clinicDocs.length}</strong></span>
                                  <span>Staff Assigned: <strong style={{ color: clinicStaff.length === 0 ? '#f59e0b' : '#10b981' }}>{clinicStaff.length}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* DOCTORS SECTION */}
                  {(adminRosterFilter === 'ALL' || adminRosterFilter === 'DOCTORS') && (
                    <div>
                      <h4 style={{ margin: '0 0 0.6rem 0', color: '#a855f7', fontSize: '0.95rem' }}>
                        👨‍⚕️ Doctors ({adminDoctors.length})
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '0.75rem' }}>
                        {adminDoctors
                          .filter((d) => {
                            if (!adminRosterSearch.trim()) return true;
                            const q = adminRosterSearch.toLowerCase();
                            return d.fullName?.toLowerCase().includes(q) || d.specialtyId?.name?.toLowerCase().includes(q) || d.clinicId?.name?.toLowerCase().includes(q);
                          })
                          .map((doc) => (
                            <div
                              key={doc._id}
                              style={{
                                background: '#0d1322',
                                border: `1px solid ${doc.isActive ? 'var(--border)' : '#7f1d1d'}`,
                                borderRadius: '6px',
                                padding: '0.85rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>Dr. {doc.fullName}</strong>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.12rem 0.35rem',
                                    borderRadius: '4px',
                                    background: doc.isActive ? '#064e3b' : '#450a0a',
                                    color: doc.isActive ? '#6ee7b7' : '#fca5a5',
                                    fontWeight: 600,
                                  }}
                                >
                                  {doc.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Specialty: <strong>{doc.specialtyId?.name || 'General'}</strong> | Clinic: {doc.clinicId?.name || 'Assigned Clinic'}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Consultation Duration: <strong>{doc.averageConsultationDurationMinutes || 15} min</strong>
                              </div>
                              <div style={{ fontSize: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: doc.hasSchedule ? '#10b981' : '#f59e0b' }}>
                                  {doc.hasSchedule ? '✓ Schedule Configured' : '⚠️ No Schedule'}
                                </span>
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
                                  onClick={() => {
                                    setAdminSubTab('schedules');
                                    initScheduleForDoctor(doc);
                                  }}
                                >
                                  Edit Schedule
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* STAFF SECTION */}
                  {(adminRosterFilter === 'ALL' || adminRosterFilter === 'STAFF') && (
                    <div>
                      <h4 style={{ margin: '0 0 0.6rem 0', color: '#10b981', fontSize: '0.95rem' }}>
                        👔 Staff Operators ({adminStaffList.length})
                      </h4>
                      {adminStaffList.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No staff members registered.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '0.75rem' }}>
                          {adminStaffList
                            .filter((s) => {
                              if (!adminRosterSearch.trim()) return true;
                              const q = adminRosterSearch.toLowerCase();
                              return s.userId?.fullName?.toLowerCase().includes(q) || s.userId?.email?.toLowerCase().includes(q) || s.clinicId?.name?.toLowerCase().includes(q);
                            })
                            .map((staff) => {
                              const isActive = staff.userId?.isActive !== false && staff.isActive !== false;
                              return (
                                <div
                                  key={staff._id}
                                  style={{
                                    background: '#0d1322',
                                    border: `1px solid ${isActive ? 'var(--border)' : '#7f1d1d'}`,
                                    borderRadius: '6px',
                                    padding: '0.85rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                      {staff.userId?.fullName || 'Staff Member'}
                                    </strong>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '0.12rem 0.35rem',
                                        borderRadius: '4px',
                                        background: isActive ? '#064e3b' : '#450a0a',
                                        color: isActive ? '#6ee7b7' : '#fca5a5',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Email: {staff.userId?.email || 'N/A'} | Phone: {staff.userId?.phone || 'N/A'}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    Role: <strong>{staff.userId?.role || 'STAFF'}</strong> | Clinic: <strong style={{ color: 'var(--primary)' }}>{staff.clinicId?.name || 'Unassigned'}</strong>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Doctor Cancel Appointment Modal (Phase 5) */}
      {doctorCancelModal.isOpen && doctorCancelModal.appointment && (
        <div className="modal-overlay" onClick={() => !doctorCancelModal.loading && setDoctorCancelModal({ isOpen: false, appointment: null, reason: '', loading: false, error: null })}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              disabled={doctorCancelModal.loading}
              onClick={() => setDoctorCancelModal({ isOpen: false, appointment: null, reason: '', loading: false, error: null })}
            >
              ×
            </button>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--status-danger)', margin: '0 0 0.5rem 0' }}>
              Cancel Consultation Appointment
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Are you sure you want to cancel this appointment? The patient will be notified and this slot will be released back to available capacity.
            </p>

            <div style={{ background: '#090d16', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div><strong>Patient:</strong> {doctorCancelModal.appointment.patientId?.fullName || 'Patient'}</div>
              <div><strong>Date & Time:</strong> {doctorCancelModal.appointment.appointmentDate} • {doctorCancelModal.appointment.timeSlot?.startTime} - {doctorCancelModal.appointment.timeSlot?.endTime}</div>
              <div><strong>Ref ID:</strong> #{doctorCancelModal.appointment._id}</div>
            </div>

            {doctorCancelModal.error && (
              <div style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fee2e2', padding: '0.65rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {doctorCancelModal.error}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Reason for Cancellation (Optional)
              </label>
              <textarea
                className="filter-input"
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', resize: 'vertical' }}
                placeholder="e.g., Doctor emergency, surgery schedule conflict, clinic maintenance..."
                value={doctorCancelModal.reason}
                onChange={(e) => setDoctorCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                disabled={doctorCancelModal.loading}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={doctorCancelModal.loading}
                onClick={() => setDoctorCancelModal({ isOpen: false, appointment: null, reason: '', loading: false, error: null })}
              >
                Keep Appointment
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#ef4444' }}
                disabled={doctorCancelModal.loading}
                onClick={handleDoctorCancelAppointment}
              >
                {doctorCancelModal.loading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Notification Center Drawer Modal (Phase 13) */}
      {showNotificationDrawer && (
        <div className="modal-overlay" onClick={() => setShowNotificationDrawer(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowNotificationDrawer(false)}>×</button>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>🔔 In-App Notifications ({unreadCount} unread)</h3>

            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                No notifications found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      background: notif.isRead ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.9)',
                      border: notif.isRead ? '1px solid var(--border)' : '1px solid var(--primary)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: notif.isRead ? 'var(--text-main)' : 'var(--primary)' }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                      {notif.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>{new Date(notif.createdAt).toLocaleTimeString()}</span>
                      {!notif.isRead && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authentication & Registration Modal (Phase 13) */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            <div className="auth-dialog-header">
              <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'var(--primary-gradient)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', margin: '0 auto 0.75rem auto', boxShadow: '0 0 16px -2px rgba(14, 165, 233, 0.5)' }}>
                <IconShield />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-main)' }}>
                {authMode === 'login' ? 'Sign In to QFlow' : 'Create Patient Account'}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {authMode === 'login'
                  ? 'Access your appointments, live queue tokens, and consultations.'
                  : 'Register for instant appointment booking and live queue tracking.'}
              </div>
            </div>

            <div className="auth-tabs-row">
              <button
                type="button"
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
              >
                Register
              </button>
            </div>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconShield />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="filter-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Full Legal Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      className="filter-input"
                      style={{ width: '100%' }}
                      value={authForm.fullName}
                      onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="filter-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      className="filter-input"
                      style={{ width: '100%' }}
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="filter-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="filter-input"
                  style={{ width: '100%' }}
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="filter-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="filter-input"
                  style={{ width: '100%' }}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.9rem' }}
              >
                {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In to Workspace' : 'Create My Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <span>
                  New patient?{' '}
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', padding: 0, fontWeight: 600 }} onClick={() => { setAuthMode('register'); setAuthError(null); }}>
                    Create account here
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{' '}
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', padding: 0, fontWeight: 600 }} onClick={() => { setAuthMode('login'); setAuthError(null); }}>
                    Sign in to your account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage 2 Doctor Profile Modal */}
      {selectedDoctor && profileData && (
        <div className="modal-overlay" onClick={() => setSelectedDoctor(null)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedDoctor(null)}>×</button>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--surface-elevated)', border: '2px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                {profileData.fullName ? profileData.fullName.replace(/^Dr\.?\s*/i, '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'DR'}
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Dr. {profileData.fullName}</h2>
                <span className="doc-specialty-badge">{profileData.specialty?.name || 'General Practice'}</span>
              </div>
            </div>

            <div style={{ background: 'var(--surface-ground)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div><strong>Qualifications:</strong> {profileData.qualifications?.join(', ') || 'MBBS'}</div>
              <div><strong>Clinical Experience:</strong> {profileData.experienceYears} Years</div>
              <div><strong>Consultation Fee:</strong> <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>₹{profileData.consultationFee}</span></div>
              <div><strong>Weekly Schedule:</strong> {profileData.workingDays && profileData.workingDays.length > 0 ? formatWorkingDays(profileData.workingDays) : 'Schedule not configured'}</div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} onClick={() => handleProceedToAppointment(selectedDoctor)}>
              Proceed to Book Appointment →
            </button>
          </div>
        </div>
      )}

      {/* Stage 3 Booking Modal */}
      {bookingDoctor && (
        <div className="modal-overlay" onClick={() => setBookingDoctor(null)}>
          <div className="modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBookingDoctor(null)}>×</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Book Consultation Slot</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Select your appointment date and preferred consultation time with <strong>Dr. {bookingDoctor.fullName}</strong>.
              {bookingDoctor.workingDays && bookingDoctor.workingDays.length > 0 && (
                <div style={{ marginTop: '0.35rem', color: 'var(--primary-light)', fontSize: '0.8rem' }}>
                  Weekly Working Days: <strong>{formatWorkingDays(bookingDoctor.workingDays)}</strong>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="filter-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Consultation Date</label>
              <input
                type="date"
                className="filter-input"
                value={selectedDate}
                min={getTodayDateIST()}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="filter-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Available Slots</label>
              {loadingAvail ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Checking clinic calendar slots...</div>
              ) : availability?.availableSlots?.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '0.5rem' }}>
                  {availability.availableSlots.map((slot) => (
                    <button
                      key={`${slot.startTime}-${slot.endTime}`}
                      className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.6rem' }}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot.startTime} - {slot.endTime}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--surface-ground)', padding: '1.1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                  {availability?.message ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                        {availability.message.includes('not configured')
                          ? 'Schedule Not Configured'
                          : availability.message.includes('does not work')
                          ? 'Doctor Off-Duty On This Day'
                          : availability.isPastDate
                          ? 'Past Date Selected'
                          : availability.isError
                          ? 'Availability Notice'
                          : 'No Slots Available'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {availability.message}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                        No Remaining Slots
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        All consultation slots for this date are fully booked or have passed. Please choose another date.
                      </div>
                    </div>
                  )}
                  {availability?.isError && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', marginTop: '0.75rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => {
                        if (bookingDoctor && selectedDate) {
                          setLoadingAvail(true);
                          fetchDoctorAvailability(bookingDoctor._id, selectedDate).then((res) => {
                            if (res.ok && res.data) {
                              setAvailability(res.data);
                            } else {
                              setAvailability({
                                success: false,
                                availableSlots: [],
                                message:
                                  res.data?.message ||
                                  res.error ||
                                  'Unable to load appointment availability. Please check your connection and try again.',
                                isError: true,
                                status: res.status,
                              });
                            }
                            setLoadingAvail(false);
                          });
                        }
                      }}
                    >
                      Retry Loading Slots
                    </button>
                  )}
                </div>
              )}
            </div>

            {bookingError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {bookingError}
              </div>
            )}

            {selectedSlot && (
              <div style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>Selected Consultation Slot:</div>
                  <div style={{ color: 'var(--text-main)', marginTop: '0.15rem' }}>
                    {selectedDate} at <strong>{selectedSlot.startTime} – {selectedSlot.endTime}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consultation Fee</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹{bookingDoctor.consultationFee || 0}</div>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}
              disabled={!selectedSlot || bookingLoading}
              onClick={handleConfirmBooking}
            >
              {bookingLoading
                ? 'Booking Consultation Slot...'
                : selectedSlot
                ? `Confirm Booking (${selectedSlot.startTime} - ${selectedSlot.endTime})`
                : 'Select a Slot to Continue'}
            </button>
          </div>
        </div>
      )}

      {/* Stage 4 Appointment Confirmation Modal */}
      {bookingSuccess && (
        <div className="modal-overlay" onClick={() => setBookingSuccess(null)}>
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBookingSuccess(null)}>×</button>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
              Appointment Confirmed!
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Your consultation has been successfully reserved with the clinic.
            </div>

            <div style={{ background: 'var(--surface-ground)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'left', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Doctor:</span>
                <strong style={{ color: 'var(--text-main)' }}>Dr. {bookingSuccess.doctorName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Clinic:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{bookingSuccess.clinicName || 'Assigned Clinic'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                <strong>{bookingSuccess.appointmentDate}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Time Slot:</span>
                <strong style={{ color: 'var(--primary-light)' }}>
                  {bookingSuccess.timeSlot?.startTime} - {bookingSuccess.timeSlot?.endTime}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className="badge badge-success">BOOKED</span>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              ℹ️ Please arrive at the clinic 15–30 minutes prior to your slot time for check-in and queue token generation.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.65rem' }}
                onClick={() => {
                  setBookingSuccess(null);
                  setViewTab('my_appointments');
                }}
              >
                📅 View in My Appointments
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.65rem' }}
                onClick={() => setBookingSuccess(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Collapsible Toolbar (Preserved for Testing & Backward Compatibility) */}
      <details className="developer-tools-drawer">
        <summary>
          🛠️ Developer Tools & Raw JWT Token Inspector (Collapsible)
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem', fontSize: '0.75rem' }}>
          <div>
            <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '0.25rem' }}>Patient Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={patientToken} onChange={(e) => setPatientToken(e.target.value)} />
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '0.25rem' }}>Staff Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={staffToken} onChange={(e) => setStaffToken(e.target.value)} />
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '0.25rem' }}>Doctor Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={doctorToken} onChange={(e) => setDoctorToken(e.target.value)} />
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '0.25rem' }}>Admin Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
          </div>
        </div>
      </details>
      </main>
    </div>
  );
}
