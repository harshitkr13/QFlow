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
} from './services/api';
import './App.css';

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
    <div className="container">
      {/* Top Application Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="title" style={{ margin: 0, textAlign: 'left', fontSize: '1.75rem' }}>QFlow</h1>
          <div className="subtitle" style={{ textAlign: 'left' }}>Healthcare Virtual Queue & Clinic Management</div>
        </div>

        {/* User Identity & Navigation Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Notification Bell (Patient Only) */}
          {currentRole === 'PATIENT' && (
            <button
              className="btn btn-secondary"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setShowNotificationDrawer(true)}
            >
              🔔 Notifications
              {unreadCount > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 'bold' }}>
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {authSession?.user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{authSession.user.name || 'User'}</div>
                <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>{currentRole}</div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
              🔑 Sign In / Register
            </button>
          )}
        </div>

        {/* Role-Based Navigation Bar */}
        <div style={{ width: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {/* Patient Views */}
          {(currentRole === 'GUEST' || currentRole === 'PATIENT') && (
            <button className={`btn ${viewTab === 'discover' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('discover')}>
              🔍 Find Doctors
            </button>
          )}

          {currentRole === 'PATIENT' && (
            <>
              <button className={`btn ${viewTab === 'my_appointments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('my_appointments')}>
                📅 My Appointments
              </button>
              <button className={`btn ${viewTab === 'live_queue' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('live_queue')}>
                🎫 My Live Queue
              </button>
              <button className={`btn ${viewTab === 'billing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('billing')}>
                💳 Invoices & Payments
              </button>
            </>
          )}

          {/* Doctor View */}
          {currentRole === 'DOCTOR' && (
            <button className={`btn ${viewTab === 'doctor_cockpit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('doctor_cockpit')}>
              🩺 Doctor Cockpit
            </button>
          )}

          {/* Staff & Admin Views */}
          {(currentRole === 'STAFF' || currentRole === 'ADMIN') && (
            <>
              <button className={`btn ${viewTab === 'reception' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('reception')}>
                🏥 Reception Desk
              </button>
              <button className={`btn ${viewTab === 'billing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('billing')}>
                💳 Billing & Refunds
              </button>
            </>
          )}

          {/* Analytics & Intelligence Views */}
          {(currentRole === 'STAFF' || currentRole === 'DOCTOR' || currentRole === 'ADMIN') && (
            <>
              <button className={`btn ${viewTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('analytics')}>
                📊 Analytics
              </button>
              <button className={`btn ${viewTab === 'intelligence' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('intelligence')}>
                🧠 AI Intelligence
              </button>
            </>
          )}

          {/* Public Kiosk Display (All Roles & Guest) */}
          <button className={`btn ${viewTab === 'public_display' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewTab('public_display')}>
            📺 Public Display
          </button>
        </div>
      </header>

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
          {/* Location Banner */}
          <div className="location-banner">
            <div className="location-info">
              <span>📍</span>
              <span>{locStatus}</span>
            </div>
            <button className="btn btn-secondary" onClick={handleGetLocation}>
              Use Current Location
            </button>
          </div>

          {/* Specialties Filter Chips */}
          <div className="categories-bar">
            <button className={`category-chip ${selectedSpecialty === '' ? 'active' : ''}`} onClick={() => setSelectedSpecialty('')}>
              All Specialties
            </button>
            {specialties.map((s) => (
              <button key={s._id} className={`category-chip ${selectedSpecialty === s._id ? 'active' : ''}`} onClick={() => setSelectedSpecialty(s._id)}>
                {s.name}
              </button>
            ))}
          </div>

          {/* Filters Panel */}
          <div className="filters-panel">
            <div className="filter-group">
              <label className="filter-label">Sort By</label>
              <select className="filter-input" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="rating">Highest Rated</option>
                <option value="experience">Most Experienced</option>
                {coords && <option value="nearest">Nearest</option>}
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Min Rating</label>
              <select className="filter-input" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="">Any</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="4.0">4.0+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Max Fee (₹)</label>
              <input type="number" className="filter-input" placeholder="e.g. 1000" value={maxFee} onChange={(e) => setMaxFee(e.target.value)} />
            </div>
          </div>

          {/* Doctors List */}
          {loading ? (
            <div className="empty-state">Loading doctors...</div>
          ) : error ? (
            <div className="empty-state">{error}</div>
          ) : doctors.length === 0 ? (
            <div className="empty-state">No doctors match your search criteria.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {doctors.map((d) => (
                <div key={d._id} className="card" style={{ padding: '1rem', background: '#090d16', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>{d.fullName}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>{d.specialty?.name || 'General'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {d.clinic?.name} • ₹{d.consultationFee} • {d.experienceYears} yrs exp • ⭐ {d.averageRating?.toFixed(1) || '0.0'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleOpenProfile(d._id)}>
                      View Profile
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleProceedToAppointment(d)}>
                      Book Slot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: My Appointments (Patient) */}
      {viewTab === 'my_appointments' && (
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2>📅 My Appointments</h2>
          {myAppointments.length === 0 ? (
            <div className="empty-state">No appointments booked yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myAppointments.map((appt) => (
                <div key={appt._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Dr. {appt.doctorId?.userId?.name || appt.doctorId?.fullName || 'Doctor'}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Date: {appt.appointmentDate} | Slot: {appt.slotTime} | Status: <strong style={{ color: 'var(--primary)' }}>{appt.status}</strong>
                    </div>
                  </div>
                  {appt.status === 'BOOKED' && (
                    <button className="btn btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleCancelAppointment(appt._id)}>
                      Cancel
                    </button>
                  )}
                </div>
              ))}
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
                  <div key={entry._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span>Token #{entry.tokenNumber} - {entry.patientId?.fullName || 'Patient'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.source}</span>
                  </div>
                ))
              )}
            </div>
          </div>
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
        <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2>📺 Anonymous Public Queue Display Board</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              className="filter-input"
              placeholder="Enter Clinic ID..."
              value={publicClinicId}
              onChange={(e) => setPublicClinicId(e.target.value)}
            />
            <button className="btn btn-primary" onClick={loadPublicDisplay}>
              Load Display Feed
            </button>
          </div>

          {publicDisplayData && (
            <div style={{ background: '#090d16', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--primary)' }}>{publicDisplayData.clinicName || 'Clinic Public Display'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Now Serving</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    #{publicDisplayData.currentServingToken || 'IDLE'}
                  </div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Waiting</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#eab308' }}>
                    {publicDisplayData.totalWaiting || 0}
                  </div>
                </div>
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
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>
              {authMode === 'login' ? '🔑 Sign In to QFlow' : '📝 Create Patient Account'}
            </h3>

            {authError && (
              <div style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {authMode === 'register' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</label>
                    <input
                      type="text"
                      required
                      className="filter-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={authForm.fullName}
                      onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone Number</label>
                    <input
                      type="tel"
                      required
                      className="filter-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email Address</label>
                <input
                  type="email"
                  required
                  className="filter-input"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Password</label>
                <input
                  type="password"
                  required
                  className="filter-input"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>

              <button type="submit" disabled={authLoading} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }} onClick={() => { setAuthMode('register'); setAuthError(null); }}>
                    Register here
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{' '}
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }} onClick={() => { setAuthMode('login'); setAuthError(null); }}>
                    Sign in here
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedDoctor(null)}>×</button>
            <h2>Dr. {profileData.fullName}</h2>
            <p style={{ color: 'var(--primary)' }}>{profileData.specialty?.name}</p>
            <p>{profileData.qualifications?.join(', ')} • {profileData.experienceYears} Years Experience</p>
            <p>Fee: ₹{profileData.consultationFee}</p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => handleProceedToAppointment(selectedDoctor)}>
              Proceed to Book Appointment
            </button>
          </div>
        </div>
      )}

      {/* Stage 3 Booking Modal */}
      {bookingDoctor && (
        <div className="modal-overlay" onClick={() => setBookingDoctor(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBookingDoctor(null)}>×</button>
            <h2>Book Appointment — Dr. {bookingDoctor.fullName}</h2>
            <input type="date" className="filter-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: '100%', margin: '1rem 0' }} />
            {loadingAvail ? (
              <p>Checking slots...</p>
            ) : availability?.availableSlots?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                {availability.availableSlots.map((slot) => (
                  <button
                    key={slot}
                    className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No slots available for this date.</p>
            )}

            {bookingError && <p style={{ color: '#ef4444' }}>{bookingError}</p>}

            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!selectedSlot} onClick={handleConfirmBooking}>
              Confirm Booking ({selectedSlot || 'Select a slot'})
            </button>
          </div>
        </div>
      )}

      {/* Developer Collapsible Toolbar (Preserved for Testing & Backward Compatibility) */}
      <details style={{ marginTop: '3rem', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          🛠️ Developer Tools & Raw JWT Token Inspector (Collapsible)
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.75rem' }}>
          <div>
            <span>Patient Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={patientToken} onChange={(e) => setPatientToken(e.target.value)} />
          </div>
          <div>
            <span>Staff Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={staffToken} onChange={(e) => setStaffToken(e.target.value)} />
          </div>
          <div>
            <span>Doctor Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={doctorToken} onChange={(e) => setDoctorToken(e.target.value)} />
          </div>
          <div>
            <span>Admin Token:</span>
            <input type="text" className="filter-input" style={{ width: '100%' }} value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
          </div>
        </div>
      </details>
    </div>
  );
}
