import mongoose from 'mongoose';
import { Notification, Patient } from '../models/index.js';

/**
 * @desc    Get Patient Notifications (PATIENT Role Only)
 * @route   GET /api/patient/notifications
 * @access  Private (PATIENT)
 */
export const getPatientNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    let patient = await Patient.findOne({ userId });
    if (!patient && req.user.patientId) {
      patient = await Patient.findOne({ _id: req.user.patientId });
    }
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const notifications = await Notification.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ patientId: patient._id, isRead: false });

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n._id,
        queueEntryId: n.queueEntryId,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark Notification as Read (PATIENT Role Only, Scoped to Authenticated Patient)
 * @route   PATCH /api/patient/notifications/:id/read
 * @access  Private (PATIENT)
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    let patient = await Patient.findOne({ userId });
    if (!patient && req.user.patientId) {
      patient = await Patient.findOne({ _id: req.user.patientId });
    }
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid notification ID is required' });
    }

    // Ownership-enforced update query
    const notification = await Notification.findOneAndUpdate(
      { _id: id, patientId: patient._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found or unauthorized' });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification: {
        id: notification._id,
        isRead: notification.isRead,
      },
    });
  } catch (error) {
    next(error);
  }
};
