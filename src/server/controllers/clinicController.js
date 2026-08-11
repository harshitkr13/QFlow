import { Clinic } from '../models/index.js';

/**
 * Validate GeoJSON Point structure
 */
const validateGeoJSON = (location) => {
  if (!location) return 'Location object is required';
  if (location.type !== 'Point') return 'Location type must be "Point"';
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return 'Location coordinates must be an array of [longitude, latitude]';
  }
  const [lng, lat] = location.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
    return 'Longitude and latitude coordinates must be valid numbers';
  }
  if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180';
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90';
  return null;
};

/**
 * @desc    Get all active clinics (or all clinics for Admin)
 * @route   GET /api/clinics
 * @access  Public / Protected
 */
export const getClinics = async (req, res, next) => {
  try {
    const filter = req.user && req.user.role === 'ADMIN' ? {} : { isActive: true };
    const clinics = await Clinic.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: clinics.length,
      clinics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single clinic by ID
 * @route   GET /api/clinics/:id
 * @access  Public / Protected
 */
export const getClinicById = async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    if (!clinic.isActive && (!req.user || req.user.role !== 'ADMIN')) {
      return res.status(404).json({
        success: false,
        message: 'Clinic is currently inactive',
      });
    }

    return res.status(200).json({
      success: true,
      clinic,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new clinic (Admin only)
 * @route   POST /api/admin/clinics
 * @access  Private (ADMIN)
 */
export const createClinic = async (req, res, next) => {
  try {
    const { name, address, location, phone, email, adminId, queuePolicy } = req.body;

    if (!name || !address || !phone || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide clinic name, address, phone, and adminId',
      });
    }

    if (!address.street || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({
        success: false,
        message: 'Complete address (street, city, state, pincode) is required',
      });
    }

    const geoError = validateGeoJSON(location);
    if (geoError) {
      return res.status(400).json({
        success: false,
        message: geoError,
      });
    }

    if (queuePolicy && queuePolicy !== 'HYBRID') {
      return res.status(400).json({
        success: false,
        message: 'Queue policy must be "HYBRID" for MVP',
      });
    }

    const clinic = await Clinic.create({
      name: name.trim(),
      address: {
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        pincode: address.pincode.trim(),
      },
      location,
      phone: phone.trim(),
      email: email ? email.toLowerCase().trim() : null,
      adminId,
      queuePolicy: queuePolicy || 'HYBRID',
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Clinic created successfully',
      clinic,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update clinic (Admin only)
 * @route   PATCH /api/admin/clinics/:id
 * @access  Private (ADMIN)
 */
export const updateClinic = async (req, res, next) => {
  try {
    const { name, address, location, phone, email, queuePolicy, isActive } = req.body;

    const clinic = await Clinic.findById(req.params.id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    if (location) {
      const geoError = validateGeoJSON(location);
      if (geoError) {
        return res.status(400).json({
          success: false,
          message: geoError,
        });
      }
      clinic.location = location;
    }

    if (queuePolicy && queuePolicy !== 'HYBRID') {
      return res.status(400).json({
        success: false,
        message: 'Queue policy must be "HYBRID" for MVP',
      });
    }

    if (name) clinic.name = name.trim();
    if (address) {
      if (address.street) clinic.address.street = address.street.trim();
      if (address.city) clinic.address.city = address.city.trim();
      if (address.state) clinic.address.state = address.state.trim();
      if (address.pincode) clinic.address.pincode = address.pincode.trim();
    }
    if (phone) clinic.phone = phone.trim();
    if (email !== undefined) clinic.email = email ? email.toLowerCase().trim() : null;
    if (queuePolicy) clinic.queuePolicy = queuePolicy;
    if (typeof isActive === 'boolean') clinic.isActive = isActive;

    await clinic.save();

    return res.status(200).json({
      success: true,
      message: 'Clinic updated successfully',
      clinic,
    });
  } catch (error) {
    next(error);
  }
};
