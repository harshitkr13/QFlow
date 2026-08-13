import { useState, useEffect } from 'react';
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
} from './services/api';
import './App.css';

export default function App() {
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [sort, setSort] = useState('rating');
  const [minRating, setMinRating] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [doctorGender, setDoctorGender] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);

  // Location state
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('Location: Not requested');

  // Modal / Profile state
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [profileData, setProfileData] = useState(null);

  // Stage 3 Booking State
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [availability, setAvailability] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  // Patient & Staff Auth token states
  const [patientToken, setPatientToken] = useState('');
  const [staffToken, setStaffToken] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [viewTab, setViewTab] = useState('discover'); // 'discover' | 'my_appointments' | 'reception'

  // Reception Dashboard State (Phase 07)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStaffPatient, setSelectedStaffPatient] = useState(null);
  const [newPatientForm, setNewPatientForm] = useState({ fullName: '', phone: '', gender: 'MALE' });
  const [receptionDoctorId, setReceptionDoctorId] = useState('');
  const [allocatedTokenCard, setAllocatedTokenCard] = useState(null);
  const [todayQueue, setTodayQueue] = useState([]);
  const [receptionMessage, setReceptionMessage] = useState(null);

  // Load Specialties & Doctors
  useEffect(() => {
    fetchSpecialties().then((res) => {
      if (res.ok && res.data.specialties) {
        setSpecialties(res.data.specialties);
      }
    });
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Geolocation is not supported by your browser');
      return;
    }
    setLocStatus('Acquiring location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ latitude: lat, longitude: lng });
        setLocStatus(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setSort('nearest');
      },
      (err) => {
        setLocStatus(`Location denied or unavailable (${err.message}). Showing all locations.`);
      }
    );
  };

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
      alert('Please paste a valid Patient JWT token in the drawer above.');
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

  // Staff Patient Search (Phase 07)
  const handleStaffPatientSearch = async () => {
    if (!staffToken || !searchQuery) return;
    setReceptionMessage(null);
    const isPhone = /^\d+$/.test(searchQuery);
    const searchBody = isPhone ? { phone: searchQuery } : { name: searchQuery };
    const res = await searchStaffPatients(searchBody, staffToken);
    if (res.ok && res.data.patients) {
      setSearchResults(res.data.patients);
    } else {
      setSearchResults([]);
      setReceptionMessage(res.data?.message || 'No patients found');
    }
  };

  // Staff Create Walk-In Patient (Phase 07)
  const handleCreateWalkInPatient = async () => {
    if (!staffToken || !newPatientForm.fullName || !newPatientForm.phone) return;
    setReceptionMessage(null);
    const res = await createWalkInPatient(newPatientForm, staffToken);
    if (res.ok && res.data.patient) {
      setSelectedStaffPatient(res.data.patient);
      setNewPatientForm({ fullName: '', phone: '', gender: 'MALE' });
      setReceptionMessage('Walk-in patient profile created successfully!');
    } else {
      setReceptionMessage(`Error: ${res.data?.message || res.error}`);
    }
  };

  // Staff Register Walk-In (Phase 07)
  const handleRegisterWalkIn = async () => {
    if (!staffToken || !selectedStaffPatient || !receptionDoctorId) return;
    setReceptionMessage(null);
    const body = { doctorId: receptionDoctorId, patientId: selectedStaffPatient._id };
    const res = await registerWalkIn(body, staffToken);
    if (res.ok && res.data.queueEntry) {
      setAllocatedTokenCard(res.data.queueEntry);
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`Walk-in error: ${res.data?.message || res.error}`);
    }
  };

  // Staff Check-In Online Appointment (Phase 07)
  const handleStaffCheckInAppt = async (apptId) => {
    if (!staffToken) return;
    setReceptionMessage(null);
    const res = await checkInAppointment(apptId, staffToken);
    if (res.ok && res.data.queueEntry) {
      setAllocatedTokenCard({
        ...res.data.queueEntry,
        patientName: res.data.appointment?.patientId?.fullName || 'Online Patient',
      });
      loadTodayStaffQueue();
    } else {
      setReceptionMessage(`Check-in error: ${res.data?.message || res.error}`);
    }
  };

  // Load Today's Staff Queue (Phase 07)
  const loadTodayStaffQueue = async () => {
    if (!staffToken) return;
    const res = await fetchTodayStaffQueue(staffToken, { doctorId: receptionDoctorId });
    if (res.ok && res.data.queueEntries) {
      setTodayQueue(res.data.queueEntries);
    }
  };

  useEffect(() => {
    if (viewTab === 'reception' && staffToken) {
      loadTodayStaffQueue();
    }
  }, [viewTab, staffToken, receptionDoctorId]);

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">QFlow Healthcare</h1>
        <p className="subtitle">Phase 07 — Walk-In Registration & Check-In Token Allocation</p>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            className={`btn ${viewTab === 'discover' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setViewTab('discover'); setBookingDoctor(null); setBookingSuccess(null); }}
          >
            🔍 Patient Discovery
          </button>
          <button
            className={`btn ${viewTab === 'my_appointments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewTab('my_appointments')}
          >
            📅 My Appointments
          </button>
          <button
            className={`btn ${viewTab === 'reception' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewTab('reception')}
          >
            🏥 Staff Reception Desk
          </button>
        </div>
      </header>

      {/* Auth Token Drawer */}
      <div style={{ background: '#090d16', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Patient JWT Token: </span>
          <input
            type="text"
            className="filter-input"
            placeholder="Paste Patient JWT Token"
            value={patientToken}
            onChange={(e) => setPatientToken(e.target.value.trim())}
            style={{ width: '90%', marginTop: '0.25rem' }}
          />
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Staff/Admin JWT Token: </span>
          <input
            type="text"
            className="filter-input"
            placeholder="Paste Staff JWT Token"
            value={staffToken}
            onChange={(e) => setStaffToken(e.target.value.trim())}
            style={{ width: '90%', marginTop: '0.25rem' }}
          />
        </div>
      </div>

      {/* VIEW: Staff Reception Desk (Phase 07) */}
      {viewTab === 'reception' ? (
        <div className="card">
          <h2>🏥 Reception Desk — Walk-In Registration & Check-In</h2>
          {!staffToken ? (
            <div className="empty-state">Please paste a valid Staff/Admin JWT token in the drawer above.</div>
          ) : (
            <div>
              {receptionMessage && (
                <div style={{ background: '#1c1917', border: '1px solid var(--primary)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-main)', marginBottom: '1rem' }}>
                  {receptionMessage}
                </div>
              )}

              {/* Token Allocation Confirmation Card */}
              {allocatedTokenCard && (
                <div style={{ background: '#064e3b', border: '1px solid var(--success-text)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', textAlign: 'center' }}>
                  <h3 style={{ color: '#6ee7b7', margin: 0 }}>✓ QUEUE TOKEN ALLOCATED</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', margin: '0.5rem 0' }}>
                    Token #{allocatedTokenCard.tokenNumber}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#a7f3d0' }}>
                    Patient: {allocatedTokenCard.patientName || 'Patient'} | Source: {allocatedTokenCard.source} | Date: {allocatedTokenCard.queueDate}
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }} onClick={() => setAllocatedTokenCard(null)}>
                    Dismiss Token Card
                  </button>
                </div>
              )}

              {/* Doctor Selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="filter-label">Select Doctor for Queue Operations: </label>
                <select
                  className="filter-select"
                  value={receptionDoctorId}
                  onChange={(e) => setReceptionDoctorId(e.target.value)}
                  style={{ marginLeft: '0.5rem', width: '300px' }}
                >
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>{d.fullName} ({d.specialty?.name || 'Doctor'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Left Column: Patient Search & Walk-In Registration */}
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>1. Search or Create Patient</h3>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Phone or Name search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={handleStaffPatientSearch}>Search</button>
                  </div>

                  {searchResults.length > 0 && (
                    <div style={{ background: '#111827', padding: '0.5rem', borderRadius: '6px', marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Search Results:</strong>
                      {searchResults.map((p) => (
                        <div
                          key={p._id}
                          style={{ padding: '0.4rem', borderBottom: '1px solid #1f2937', cursor: 'pointer', background: selectedStaffPatient?._id === p._id ? '#1e293b' : 'transparent' }}
                          onClick={() => setSelectedStaffPatient(p)}
                        >
                          {p.fullName} ({p.phone}) — {p.gender}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Create Walk-In Patient Sub-Form */}
                  <div style={{ borderTop: '1px solid #1f2937', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Create New Walk-In Patient Profile:</h4>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Full Name"
                      value={newPatientForm.fullName}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, fullName: e.target.value })}
                      style={{ width: '100%', marginBottom: '0.4rem' }}
                    />
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Phone Number"
                      value={newPatientForm.phone}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value })}
                      style={{ width: '100%', marginBottom: '0.4rem' }}
                    />
                    <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={handleCreateWalkInPatient}>
                      + Create Patient Profile
                    </button>
                  </div>

                  {/* Selected Patient CTA */}
                  {selectedStaffPatient && (
                    <div style={{ marginTop: '1rem', background: '#1e293b', padding: '0.75rem', borderRadius: '6px' }}>
                      <strong>Selected Patient:</strong> {selectedStaffPatient.fullName} ({selectedStaffPatient.phone})
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        onClick={handleRegisterWalkIn}
                      >
                        REGISTER WALK-IN (ALLOCATE TOKEN)
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: Today's Live Queue List */}
                <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>2. Today's Operational Queue</h3>
                  {todayQueue.length === 0 ? (
                    <div className="empty-state">No queue entries created yet for today.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {todayQueue.map((q) => (
                        <div key={q._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.6rem', borderRadius: '6px' }}>
                          <div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#6ee7b7', marginRight: '0.5rem' }}>
                              #{q.tokenNumber}
                            </span>
                            <span>{q.patientId?.fullName || 'Patient'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                              [{q.source}]
                            </span>
                          </div>
                          <span className="status-badge status-connected">{q.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : bookingSuccess ? (
        /* VIEW: Stage 3 Booking Confirmation Screen */
        <div className="card">
          <h2 style={{ color: 'var(--success-text)', marginBottom: '0.5rem' }}>✓ Appointment Booked Successfully!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Your online appointment has been confirmed in `BOOKED` status.</p>

          <div className="doctor-card-details" style={{ gridTemplateColumns: '1fr', gap: '0.5rem', background: '#090d16', padding: '1rem', borderRadius: '8px' }}>
            <div><strong>Appointment ID:</strong> {bookingSuccess._id}</div>
            <div><strong>Date:</strong> {bookingSuccess.appointmentDate}</div>
            <div><strong>Time Slot:</strong> {bookingSuccess.timeSlot?.startTime} - {bookingSuccess.timeSlot?.endTime}</div>
            <div><strong>Status:</strong> <span className="status-badge status-connected">BOOKED</span></div>
            <div><strong>Instructions:</strong> Please arrive at the clinic 15 minutes before your time slot for Staff Check-In.</div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setBookingSuccess(null)}>
            Back to Patient Discovery
          </button>
        </div>
      ) : bookingDoctor ? (
        /* VIEW: Stage 3 Booking Page */
        <div className="card">
          <button className="btn btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setBookingDoctor(null)}>
            ← Back to Profile
          </button>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <img
              src={bookingDoctor.photoUrl || 'https://via.placeholder.com/150'}
              alt={bookingDoctor.fullName}
              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <h3>{bookingDoctor.fullName}</h3>
              <p style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>{bookingDoctor.specialty?.name}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {bookingDoctor.clinic?.name}</p>
            </div>
          </div>

          {bookingError && <div style={{ color: 'var(--error-text)', marginBottom: '1rem' }}>{bookingError}</div>}

          {/* Date Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="filter-label">Select Date: </label>
            <input
              type="date"
              className="filter-input"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ marginLeft: '0.5rem' }}
            />
          </div>

          {/* Time Slots Grid */}
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Available Time Slots</h4>
          {loadingAvail ? (
            <div className="empty-state">Loading availability...</div>
          ) : !availability || availability.availableSlots.length === 0 ? (
            <div className="empty-state">No available slots for selected date.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {availability.availableSlots.map((slot, idx) => (
                <button
                  key={idx}
                  className={`category-chip ${selectedSlot?.startTime === slot.startTime ? 'active' : ''}`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot.startTime} - {slot.endTime}
                </button>
              ))}
            </div>
          )}

          {/* Summary & Confirm */}
          {selectedSlot && (
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <h4>Booking Summary</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Date: {selectedDate} | Time: {selectedSlot.startTime} - {selectedSlot.endTime} | Fee: ₹{bookingDoctor.consultationFee || 0}
              </p>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={!selectedSlot}
            onClick={handleConfirmBooking}
          >
            CONFIRM APPOINTMENT
          </button>
        </div>
      ) : viewTab === 'my_appointments' ? (
        /* VIEW: Patient Appointments Dashboard */
        <div className="card">
          <h2>My Appointments</h2>
          {!patientToken ? (
            <div className="empty-state">Please paste a valid Patient JWT token above to view your appointments.</div>
          ) : myAppointments.length === 0 ? (
            <div className="empty-state">No appointments found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {myAppointments.map((appt) => (
                <div key={appt._id} style={{ background: '#090d16', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{appt.doctorId?.fullName || 'Doctor'}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {appt.clinicId?.name}</div>
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        📅 {appt.appointmentDate} @ {appt.timeSlot?.startTime} - {appt.timeSlot?.endTime}
                      </div>
                    </div>
                    <div>
                      <span className={`status-badge ${appt.status === 'BOOKED' ? 'status-connected' : 'status-warning'}`}>
                        {appt.status}
                      </span>
                      {appt.status === 'BOOKED' && (
                        <button
                          className="btn btn-secondary"
                          style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleCancelAppointment(appt._id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW: Patient Discovery View */
        <div className="discovery-layout">
          {/* Location Banner */}
          <div className="location-banner">
            <div className="location-info">
              <span>📍</span>
              <span>{locStatus}</span>
            </div>
            <button className="btn btn-secondary" onClick={handleGetLocation}>
              {coords ? 'Refresh Location' : 'Use My Location'}
            </button>
          </div>

          {/* Specialty Categories */}
          <div className="categories-bar">
            <button
              className={`category-chip ${selectedSpecialty === '' ? 'active' : ''}`}
              onClick={() => setSelectedSpecialty('')}
            >
              All Specialties
            </button>
            {specialties.map((spec) => (
              <button
                key={spec._id}
                className={`category-chip ${selectedSpecialty === spec._id ? 'active' : ''}`}
                onClick={() => setSelectedSpecialty(spec._id)}
              >
                {spec.name}
              </button>
            ))}
          </div>

          {/* Filters & Sorting */}
          <div className="filters-panel">
            <div className="filter-group">
              <span className="filter-label">Sort By</span>
              <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {coords && <option value="nearest">Nearest First</option>}
                <option value="rating">Highest Rated</option>
                <option value="experience">Most Experienced</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Min Rating</span>
              <select className="filter-select" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="">Any Rating</option>
                <option value="4.5">4.5+ ★</option>
                <option value="4.0">4.0+ ★</option>
                <option value="3.5">3.5+ ★</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Min Experience</span>
              <select className="filter-select" value={minExperience} onChange={(e) => setMinExperience(e.target.value)}>
                <option value="">Any Experience</option>
                <option value="5">5+ Years</option>
                <option value="10">10+ Years</option>
                <option value="15">15+ Years</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Max Fee (₹)</span>
              <input
                type="number"
                className="filter-input"
                placeholder="e.g. 1000"
                value={maxFee}
                onChange={(e) => setMaxFee(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">Doctor Gender</span>
              <select className="filter-select" value={doctorGender} onChange={(e) => setDoctorGender(e.target.value)}>
                <option value="">Any Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
          </div>

          {/* Stage 1 Results Grid */}
          {loading ? (
            <div className="empty-state">Searching healthcare providers...</div>
          ) : error ? (
            <div className="empty-state" style={{ color: 'var(--error-text)' }}>{error}</div>
          ) : doctors.length === 0 ? (
            <div className="empty-state">No doctors found matching your criteria.</div>
          ) : (
            <div className="doctors-grid">
              {doctors.map((doc) => (
                <div key={doc._id} className="doctor-card">
                  <div>
                    <div className="doctor-card-header">
                      <img
                        src={doc.photoUrl || 'https://via.placeholder.com/150'}
                        alt={doc.fullName}
                        className="doctor-avatar"
                      />
                      <div className="doctor-info-primary">
                        <div className="doc-name">{doc.fullName}</div>
                        <div className="doc-specialty">{doc.specialty?.name || 'General Doctor'}</div>
                        <div className="doc-clinic">📍 {doc.clinic?.name || 'Clinic'}, {doc.clinic?.city || ''}</div>
                      </div>
                    </div>

                    <div className="doctor-card-details">
                      <div className="detail-pill">
                        <span className="rating-star">★</span>
                        <span>{doc.averageRating ? doc.averageRating.toFixed(1) : 'New'} ({doc.totalReviews || 0})</span>
                      </div>
                      <div className="detail-pill">
                        <span>🎓 {doc.experienceYears || 0} yrs exp</span>
                      </div>
                      <div className="detail-pill">
                        <span>💵 ₹{doc.consultationFee || 0}</span>
                      </div>
                      {doc.distanceKm !== null && doc.distanceKm !== undefined && (
                        <div className="detail-pill">
                          <span>🧭 {doc.distanceKm} km</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.75rem' }}
                    onClick={() => handleOpenProfile(doc._id)}
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stage 2 Doctor Profile Modal */}
      {selectedDoctor && profileData && (
        <div className="modal-overlay" onClick={() => setSelectedDoctor(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedDoctor(null)}>✕</button>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.25rem' }}>
              <img
                src={profileData.photoUrl || 'https://via.placeholder.com/150'}
                alt={profileData.fullName}
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)' }}>{profileData.fullName}</h2>
                <p style={{ color: 'var(--primary)', fontWeight: 500 }}>{profileData.specialty?.name}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📍 {profileData.clinic?.name}, {profileData.clinic?.address?.city}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              <div><strong>Qualifications:</strong> {profileData.qualifications ? profileData.qualifications.join(', ') : 'MBBS'}</div>
              <div><strong>Experience:</strong> {profileData.experienceYears} Years</div>
              <div><strong>Consultation Fee:</strong> ₹{profileData.consultationFee}</div>
              <div><strong>Rating:</strong> ★ {profileData.averageRating?.toFixed(1) || 'N/A'} ({profileData.totalReviews || 0} reviews)</div>
            </div>

            <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>Weekly Working Schedule</h3>
            {profileData.schedule && profileData.schedule.length > 0 ? (
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Working</th>
                    <th>Shifts</th>
                  </tr>
                </thead>
                <tbody>
                  {profileData.schedule.map((day, idx) => (
                    <tr key={idx}>
                      <td>{day.dayOfWeek}</td>
                      <td>{day.isWorkingDay ? 'Yes' : 'Off'}</td>
                      <td>
                        {day.isWorkingDay && day.shifts
                          ? day.shifts.map((s) => `${s.startTime}-${s.endTime}`).join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Schedule not configured.</p>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.85rem' }}
                onClick={() => handleProceedToAppointment(profileData)}
              >
                PROCEED TO APPOINTMENT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
