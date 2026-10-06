import { useState, useEffect, useCallback } from 'react';
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

  const loadDoctorCockpit = useCallback(async () => {
    if (!doctorToken) return;
    // Fetch doctor intelligence and status
    const intelRes = await fetchDoctorOwnIntelligence(doctorToken);
    if (intelRes.ok && intelRes.data?.data) {
      setDoctorIntel(intelRes.data.data);
    }

    // Fetch today's queue for doctor's clinic
    const todayRes = await fetchTodayStaffQueue(doctorToken);
    if (todayRes.ok && todayRes.data?.queue) {
      const allQueue = todayRes.data.queue;
      // Filter for this doctor's patients
      const myDoctorId = intelRes.data?.data?.doctorId;
      const myQueue = myDoctorId ? allQueue.filter((q) => q.doctorId?.toString() === myDoctorId) : allQueue;

      const active = myQueue.find((q) => q.status === 'IN_CONSULTATION' || q.status === 'CALLED');
      setDoctorActivePatient(active || null);
      setDoctorQueueData(myQueue.filter((q) => q.status === 'WAITING'));
    }
  }, [doctorToken]);

  useEffect(() => {
    if (viewTab === 'doctor_cockpit' && doctorToken && isTabVisible) {
      loadDoctorCockpit();
      const interval = setInterval(loadDoctorCockpit, 10000);
      return () => clearInterval(interval);
    }
  }, [viewTab, doctorToken, isTabVisible, loadDoctorCockpit]);

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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availability, setAvailability] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const [myAppointments, setMyAppointments] = useState([]);

  // Reception State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStaffPatient, setSelectedStaffPatient] = useState(null);
  const [newPatientForm, setNewPatientForm] = useState({ fullName: '', phone: '', gender: 'MALE' });
  const [receptionDoctorId, setReceptionDoctorId] = useState('');
  const [allocatedTokenCard, setAllocatedTokenCard] = useState(null);
  const [waitingEntries, setWaitingEntries] = useState([]);
  const [activeEntries, setActiveEntries] = useState([]);
  const [skippedEntries, setSkippedEntries] = useState([]);
  const [doctorQueueStatus, setDoctorQueueStatus] = useState({ isQueuePaused: false, queuePausedAt: null, queuePauseReason: null });
  const [opLoading, setOpLoading] = useState(false);
  const [receptionMessage, setReceptionMessage] = useState(null);

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
      setLoadingAvail(true);
      setSelectedSlot(null);
      fetchDoctorAvailability(bookingDoctor._id, selectedDate).then((res) => {
        if (res.ok && res.data) {
          setAvailability(res.data);
        } else {
          setAvailability(null);
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
    setBookingSuccess(null);
    setBookingError(null);
  };

  const handleConfirmBooking = async () => {
    if (!patientToken) {
      setShowAuthModal(true);
      return;
    }
    if (!bookingDoctor || !selectedSlot || !selectedDate) return;
    setBookingError(null);
    const bookingBody = {
      doctorId: bookingDoctor._id,
      appointmentDate: selectedDate,
      timeSlot: selectedSlot,
    };
    const res = await createAppointment(bookingBody, patientToken);
    if (res.ok && res.data.success) {
      setBookingSuccess(res.data.appointment);
      setBookingDoctor(null);
    } else {
      setBookingError(res.data?.message || res.error || 'Booking failed');
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
    if (!patientToken) return;
    const res = await cancelAppointment(apptId, patientToken, 'Cancelled by patient from dashboard');
    if (res.ok && res.data.success) {
      loadMyAppointments();
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

  const handleCreateWalkInPatient = async () => {
    if (!staffToken || !newPatientForm.fullName || !newPatientForm.phone) return;
    const res = await createWalkInPatient(newPatientForm, staffToken);
    if (res.ok && res.data.patient) {
      setSelectedStaffPatient(res.data.patient);
      setNewPatientForm({ fullName: '', phone: '', gender: 'MALE' });
      setReceptionMessage('✓ Walk-in patient record registered successfully');
    } else {
      setReceptionMessage(`Error: ${res.data?.message || res.error}`);
    }
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
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`Error: ${res.data?.message || res.error}`);
    }
  };

  const loadTodayStaffQueue = useCallback(async () => {
    if (!staffToken) return;
    const res = await fetchTodayStaffQueue(staffToken);
    if (res.ok && res.data) {
      const queue = res.data.queue || [];
      setWaitingEntries(queue.filter((q) => q.status === 'WAITING'));
      setActiveEntries(queue.filter((q) => q.status === 'CALLED' || q.status === 'IN_CONSULTATION'));
      setSkippedEntries(queue.filter((q) => q.status === 'SKIPPED'));
      if (res.data.doctorStatus) {
        setDoctorQueueStatus(res.data.doctorStatus);
      }
    }
  }, [staffToken]);

  useEffect(() => {
    if (viewTab === 'reception' && staffToken && isTabVisible) {
      loadTodayStaffQueue();
      const interval = setInterval(loadTodayStaffQueue, 10000);
      return () => clearInterval(interval);
    }
  }, [viewTab, staffToken, isTabVisible, loadTodayStaffQueue]);

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
  const [adminSubTab, setAdminSubTab] = useState('policy'); // 'policy' | 'queue_audit' | 'financial_audit'
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

  useEffect(() => {
    if (viewTab === 'governance' && adminToken) {
      if (adminSubTab === 'policy') loadClinicPolicy();
      if (adminSubTab === 'queue_audit') loadQueueAuditLogs(1);
      if (adminSubTab === 'financial_audit') loadFinancialAuditLogs(1);
    }
  }, [viewTab, adminSubTab, adminToken, loadClinicPolicy, loadQueueAuditLogs, loadFinancialAuditLogs]);

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
      {viewTab === 'doctor_cockpit' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', margin: 0 }}>🩺 Doctor Examination Cockpit</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Live exam room workflow, consultation duration metrics & queue controls
              </div>
            </div>

            {/* Live Operational Status Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
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

          {doctorMessage && (
            <div style={{ background: '#1c1917', border: '1px solid var(--primary)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-main)', marginBottom: '1rem' }}>
              {doctorMessage}
            </div>
          )}

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

      {/* VIEW: Find / Discover Doctors */}
      {viewTab === 'discover' && (
        <div className="discovery-layout">
          {/* Healthcare SaaS Hero Section */}
          <section className="hero-section">
            <div className="hero-pill">
              <IconPulse />
              <span>Intelligent Healthcare Queue OS</span>
            </div>
            <h1 className="hero-title">
              Precision Care, <span className="hero-title-gradient">Zero Wait-Room Friction.</span>
            </h1>
            <p className="hero-subtitle">
              Discover verified medical specialists, monitor live consultation pacing in real time, and check in effortlessly from anywhere.
            </p>
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
          </section>

          {/* Discovery Command Surface */}
          <div className="discovery-controls-card">
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
                <div key={i} className="skeleton-card">
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div className="skeleton-shimmer" style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div className="skeleton-shimmer" style={{ height: 18, width: '70%' }} />
                      <div className="skeleton-shimmer" style={{ height: 14, width: '45%' }} />
                    </div>
                  </div>
                  <div className="skeleton-shimmer" style={{ height: 60, marginBottom: '1.25rem' }} />
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div className="skeleton-shimmer" style={{ height: 38, flex: 1 }} />
                    <div className="skeleton-shimmer" style={{ height: 38, flex: 1 }} />
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
              {doctors.map((d) => {
                const initials = d.fullName
                  ? d.fullName.replace(/^Dr\.?\s*/i, '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'DR';
                return (
                  <div key={d._id} className="doctor-card">
                    <div>
                      <div className="doctor-card-top">
                        <div className="doctor-avatar-wrapper">
                          <div className="doctor-avatar-img">
                            {initials}
                          </div>
                          <span className="doctor-avail-indicator" title="Accepting Appointments" />
                        </div>
                        <div className="doctor-info-primary">
                          <div className="doc-name">{d.fullName}</div>
                          <span className="doc-specialty-badge">
                            {d.specialty?.name || 'General Practice'}
                          </span>
                          <div className="doc-clinic-name">
                            <IconLocation />
                            <span>{d.clinic?.name || 'Main Clinic Center'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Doctor Metrics Grid */}
                      <div className="doctor-metrics-grid">
                        <div className="metric-pill">
                          <span className="metric-pill-label">Rating</span>
                          <span className="metric-pill-value">
                            <span className="rating-star-icon">★</span>
                            {d.averageRating ? d.averageRating.toFixed(1) : '5.0'}
                          </span>
                        </div>
                        <div className="metric-pill">
                          <span className="metric-pill-label">Experience</span>
                          <span className="metric-pill-value">
                            {d.experienceYears ? `${d.experienceYears} yrs` : '5+ yrs'}
                          </span>
                        </div>
                        <div className="metric-pill">
                          <span className="metric-pill-label">Consultation</span>
                          <span className="metric-pill-value" style={{ color: 'var(--primary-light)' }}>
                            ₹{d.consultationFee ?? 500}
                          </span>
                        </div>
                        <div className="metric-pill">
                          <span className="metric-pill-label">Queue Pacing</span>
                          <span className="metric-pill-value" style={{ color: 'var(--status-success)', fontSize: '0.8rem' }}>
                            <IconPulse /> Active
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="doctor-actions-row">
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => handleOpenProfile(d._id)}
                      >
                        Profile
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1.3 }}
                        onClick={() => handleProceedToAppointment(d)}
                      >
                        Book Slot
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: My Appointments (Patient) */}
      {viewTab === 'my_appointments' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2>📅 My Appointments</h2>
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
            <div className="empty-state">No appointments booked yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myAppointments.map((appt) => {
                const slotTime = appt.timeSlot?.startTime || appt.slotTime || '';
                return (
                  <div key={appt._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Dr. {appt.doctorId?.userId?.name || appt.doctorId?.fullName || 'Doctor'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Date: {appt.appointmentDate} | Slot: {slotTime} | Status: <strong style={{ color: appt.status === 'EXPIRED' ? '#ef4444' : 'var(--primary)' }}>{appt.status}</strong>
                      </div>
                      {appt.status === 'BOOKED' && (
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                          Arrival window: 60 mins before to 30 mins after slot ({slotTime})
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {appt.status === 'BOOKED' && (
                        <>
                          <button
                            className="btn btn-primary"
                            disabled={selfCheckInLoading}
                            style={{ fontSize: '0.85rem' }}
                            onClick={() => handleSelfCheckIn(appt._id)}
                          >
                            ✓ Check In Now (Get Token)
                          </button>
                          <button className="btn btn-secondary" style={{ color: '#ef4444', fontSize: '0.85rem' }} onClick={() => handleCancelAppointment(appt._id)}>
                            Cancel
                          </button>
                        </>
                      )}
                      {appt.status === 'CHECKED_IN' && (
                        <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setViewTab('live_queue')}>
                          View Live Queue →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
          <h2>🏥 Staff Reception Desk — Operational Queue Management</h2>
          {receptionMessage && (
            <div style={{ background: '#1c1917', border: '1px solid var(--primary)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-main)', marginBottom: '1rem' }}>
              {receptionMessage}
            </div>
          )}

          {allocatedTokenCard && (
            <div style={{ background: '#064e3b', border: '1px solid var(--success-text)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', textAlign: 'center' }}>
              <h3 style={{ color: '#6ee7b7', margin: 0 }}>✓ QUEUE TOKEN ALLOCATED</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', margin: '0.5rem 0' }}>
                Token #{allocatedTokenCard.tokenNumber}
              </div>
              <button className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }} onClick={() => setAllocatedTokenCard(null)}>
                Dismiss
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="filter-input"
              style={{ flex: 1, minWidth: '220px' }}
              placeholder="Search patient by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleStaffPatientSearch}>
              Search Patient
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h4>Search Results</h4>
              {searchResults.map((p) => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>{p.fullName} ({p.phone})</div>
                  <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleSelectStaffPatient(p)}>
                    Select for Walk-In
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedStaffPatient && (
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--primary)' }}>
              <h4>Selected Patient: {selectedStaffPatient.fullName} ({selectedStaffPatient.phone})</h4>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <select className="filter-input" value={receptionDoctorId} onChange={(e) => setReceptionDoctorId(e.target.value)}>
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>Dr. {d.fullName}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={handleRegisterWalkInQueue}>
                  Register Walk-In & Allocate Token
                </button>
              </div>
            </div>
          )}

          {/* Queue Overview & Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn btn-primary" disabled={opLoading} onClick={handleCallNext}>
              📢 Call Next Patient
            </button>
            <button className="btn btn-secondary" onClick={handlePauseQueue}>
              ⏸ Pause Queue
            </button>
            <button className="btn btn-secondary" onClick={handleResumeQueue}>
              ▶ Resume Queue
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Active Serving Card */}
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4>Currently Serving ({activeEntries.length})</h4>
              {activeEntries.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active patient called.</div>
              ) : (
                activeEntries.map((entry) => (
                  <div key={entry._id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Token #{entry.tokenNumber} ({entry.status})</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.patientId?.fullName || 'Patient'}</div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {entry.status === 'CALLED' && (
                        <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => handleStartConsultation(entry._id)}>
                          Start
                        </button>
                      )}
                      {entry.status === 'IN_CONSULTATION' && (
                        <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => handleCompleteConsultation(entry._id)}>
                          Complete
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => handleSkip(entry._id)}>
                        Skip
                      </button>
                      <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => handleNoShow(entry._id)}>
                        No-Show
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Waiting Queue List */}
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4>Waiting in Queue ({waitingEntries.length})</h4>
              {waitingEntries.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No patients waiting.</div>
              ) : (
                waitingEntries.map((entry) => (
                  <div key={entry._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>
                        Token #{entry.tokenNumber} - {entry.patientId?.fullName || 'Patient'}
                        {entry.priority && entry.priority !== 'NORMAL' && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: entry.priority === 'EMERGENCY' ? '#dc2626' : '#d97706', color: '#fff' }}>
                            {entry.priority}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {entry.source} {entry.triageReason ? `| Triage: ${entry.triageReason}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', color: '#f59e0b' }}
                        onClick={() => handleOpenTriage(entry)}
                      >
                        ⚡ Triage
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', color: '#38bdf8' }}
                        onClick={() => handleOpenTransfer(entry)}
                      >
                        🔀 Transfer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--status-success)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                <span className="status-dot-pulse" />
                <span>Live Broadcast Kiosk</span>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="filter-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Consultation Date</label>
              <input type="date" className="filter-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="filter-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Available Slots</label>
              {loadingAvail ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Checking clinic calendar slots...</div>
              ) : availability?.availableSlots?.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '0.5rem' }}>
                  {availability.availableSlots.map((slot) => (
                    <button
                      key={slot}
                      className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.6rem' }}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--surface-ground)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  No available slots found for this date. Please choose another date.
                </div>
              )}
            </div>

            {bookingError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {bookingError}
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={!selectedSlot} onClick={handleConfirmBooking}>
              Confirm Booking ({selectedSlot || 'Select a slot'})
            </button>
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
