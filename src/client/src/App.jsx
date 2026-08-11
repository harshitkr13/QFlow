import { useState, useEffect } from 'react';
import {
  fetchSpecialties,
  discoverDoctors,
  fetchDoctorProfile,
  fetchDoctorAvailability,
  createAppointment,
  fetchMyAppointments,
  cancelAppointment,
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

  // Patient Auth token state (simulated for UI demonstration)
  const [patientToken, setPatientToken] = useState('');
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [myAppointments, setMyAppointments] = useState([]);
  const [viewTab, setViewTab] = useState('discover'); // 'discover' | 'my_appointments'

  // Load Specialties
  useEffect(() => {
    fetchSpecialties().then((res) => {
      if (res.ok && res.data.specialties) {
        setSpecialties(res.data.specialties);
      }
    });
  }, []);

  // Request browser geolocation
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

  // Load Discovery Results
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
    } else {
      setError(res.data?.message || res.error || 'Failed to discover doctors');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (viewTab === 'discover') {
      loadDiscovery();
    }
  }, [selectedSpecialty, sort, minRating, minExperience, maxFee, doctorGender, coords, radiusKm, viewTab]);

  // Load Availability when bookingDoctor or selectedDate changes
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

  // View Doctor Profile (Stage 2)
  const handleOpenProfile = async (docId) => {
    const res = await fetchDoctorProfile(docId);
    if (res.ok && res.data.doctor) {
      setProfileData(res.data.doctor);
      setSelectedDoctor(res.data.doctor);
    }
  };

  // Proceed to Appointment CTA (Stage 3 Transition)
  const handleProceedToAppointment = (doctor) => {
    setSelectedDoctor(null);
    setBookingDoctor(doctor);
    setBookingSuccess(null);
    setBookingError(null);
  };

  // Submit Booking
  const handleConfirmBooking = async () => {
    if (!patientToken) {
      setShowAuthPrompt(true);
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

  // Load Patient Appointments
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

  // Cancel Appointment
  const handleCancelAppointment = async (apptId) => {
    if (!patientToken) return;
    const res = await cancelAppointment(apptId, patientToken, 'Cancelled by patient from dashboard');
    if (res.ok && res.data.success) {
      loadMyAppointments();
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">QFlow Healthcare</h1>
        <p className="subtitle">Phase 06 — Appointment Booking & Scheduling</p>
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
        </div>
      </header>

      {/* Auth Token Drawer for Testing */}
      <div style={{ background: '#090d16', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Patient JWT Token: </span>
        <input
          type="text"
          className="filter-input"
          placeholder="Paste Patient JWT Token here to test booking"
          value={patientToken}
          onChange={(e) => setPatientToken(e.target.value.trim())}
          style={{ width: '60%', marginLeft: '0.5rem' }}
        />
      </div>

      {/* VIEW: Stage 3 Booking Confirmation Screen */}
      {bookingSuccess ? (
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
