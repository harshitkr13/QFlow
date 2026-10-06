import mongoose from 'mongoose';
import { Clinic } from '../models/index.js';

/**
 * @desc    Get Clinic Operational Policy
 * @route   GET /api/admin/clinics/:id/policy
 * @access  Private (ADMIN)
 */
export const getClinicPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clinic ID format',
      });
    }

    const clinic = await Clinic.findById(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    // Default policy fallback if operationalPolicy is not set
    const defaultPolicy = {
      selfCheckInLeadMinutes: 60,
      selfCheckInGraceMinutes: 30,
      autoExpireOnSettlement: true,
    };

    return res.status(200).json({
      success: true,
      clinicId: clinic._id,
      clinicName: clinic.name,
      policy: clinic.operationalPolicy || defaultPolicy,
      queuePolicy: clinic.queuePolicy || 'HYBRID',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Clinic Operational Policy
 * @route   PATCH /api/admin/clinics/:id/policy
 * @access  Private (ADMIN)
 */
export const updateClinicPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clinic ID format',
      });
    }

    const clinic = await Clinic.findById(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    const {
      selfCheckInLeadMinutes,
      selfCheckInGraceMinutes,
      autoExpireOnSettlement,
      queuePolicy,
    } = req.body;

    // Initialize policy if missing
    if (!clinic.operationalPolicy) {
      clinic.operationalPolicy = {
        selfCheckInLeadMinutes: 60,
        selfCheckInGraceMinutes: 30,
        autoExpireOnSettlement: true,
      };
    }

    // Server-Side Validation: selfCheckInLeadMinutes (15-180)
    if (selfCheckInLeadMinutes !== undefined) {
      const lead = Number(selfCheckInLeadMinutes);
      if (!Number.isInteger(lead) || lead < 15 || lead > 180) {
        return res.status(400).json({
          success: false,
          message: 'selfCheckInLeadMinutes must be an integer between 15 and 180 minutes',
        });
      }
      clinic.operationalPolicy.selfCheckInLeadMinutes = lead;
    }

    // Server-Side Validation: selfCheckInGraceMinutes (5-120)
    if (selfCheckInGraceMinutes !== undefined) {
      const grace = Number(selfCheckInGraceMinutes);
      if (!Number.isInteger(grace) || grace < 5 || grace > 120) {
        return res.status(400).json({
          success: false,
          message: 'selfCheckInGraceMinutes must be an integer between 5 and 120 minutes',
        });
      }
      clinic.operationalPolicy.selfCheckInGraceMinutes = grace;
    }

    // Server-Side Validation: autoExpireOnSettlement (boolean)
    if (autoExpireOnSettlement !== undefined) {
      if (typeof autoExpireOnSettlement !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'autoExpireOnSettlement must be a boolean value',
        });
      }
      clinic.operationalPolicy.autoExpireOnSettlement = autoExpireOnSettlement;
    }

    // Queue policy metadata validation (Preserving frozen Phase 08 engine)
    if (queuePolicy !== undefined) {
      const validPolicies = ['HYBRID', 'FIFO', 'APPOINTMENT_PRIORITY'];
      if (!validPolicies.includes(queuePolicy)) {
        return res.status(400).json({
          success: false,
          message: `queuePolicy must be one of: ${validPolicies.join(', ')}`,
        });
      }
      clinic.queuePolicy = queuePolicy;
    }

    await clinic.save();

    console.log(`[CLINIC_POLICY_UPDATE] Admin ${req.user._id || req.user.id} updated policy for clinic ${clinic._id}`);

    return res.status(200).json({
      success: true,
      message: 'Clinic operational policy updated successfully',
      clinicId: clinic._id,
      policy: clinic.operationalPolicy,
      queuePolicy: clinic.queuePolicy,
    });
  } catch (error) {
    next(error);
  }
};
