import mongoose from 'mongoose';
import { Rating, Doctor, Patient, QueueEntry } from '../models/index.js';

/**
 * @desc    Submit Verified Rating (PATIENT Role Only, COMPLETED Consultations Only)
 * @route   POST /api/patient/ratings
 * @access  Private (PATIENT)
 */
export const submitRating = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    let patient = await Patient.findOne({ userId });
    if (!patient && req.user.patientId) {
      patient = await Patient.findOne({ _id: req.user.patientId });
    }
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { queueEntryId, rating, reviewText } = req.body;

    if (!queueEntryId || !mongoose.Types.ObjectId.isValid(queueEntryId)) {
      return res.status(400).json({ success: false, message: 'Valid queueEntryId is required' });
    }

    const ratingVal = Number(rating);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ success: false, message: 'Rating score must be an integer between 1 and 5' });
    }

    const queueEntry = await QueueEntry.findById(queueEntryId);
    if (!queueEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    // Ownership check (IDOR protection)
    if (!queueEntry.patientId.equals(patient._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to rate this consultation' });
    }

    // Eligibility check: status MUST be COMPLETED
    if (queueEntry.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Consultation must be completed before rating. Current status: ${queueEntry.status}`,
      });
    }

    // Check for existing rating to return clean 409
    const existingRating = await Rating.findOne({ queueEntryId: queueEntry._id });
    if (existingRating) {
      return res.status(409).json({ success: false, message: 'Rating already submitted for this consultation' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [newRating] = await Rating.create(
        [
          {
            queueEntryId: queueEntry._id,
            appointmentId: queueEntry.appointmentId || null,
            doctorId: queueEntry.doctorId,
            patientId: patient._id,
            rating: ratingVal,
            reviewText: reviewText ? String(reviewText).trim() : null,
          },
        ],
        { session }
      );

      // Recalculate doctor rating summary atomically
      const stats = await Rating.aggregate([
        { $match: { doctorId: queueEntry.doctorId } },
        { $group: { _id: '$doctorId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]).session(session);

      const avgRating = stats[0] ? Math.round(stats[0].avgRating * 10) / 10 : ratingVal;
      const totalReviews = stats[0] ? stats[0].count : 1;

      await Doctor.updateOne(
        { _id: queueEntry.doctorId },
        { averageRating: avgRating, totalReviews },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        success: true,
        message: 'Rating submitted successfully',
        rating: newRating,
      });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();

      if (txError.code === 11000) {
        return res.status(409).json({ success: false, message: 'Rating already submitted for this consultation' });
      }
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Public Doctor Ratings & Reviews (Anonymous)
 * @route   GET /api/doctors/:id/ratings
 * @access  Public
 */
export const getDoctorRatings = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid doctor ID is required' });
    }

    const doctor = await Doctor.findById(id).select('fullName averageRating totalReviews');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const ratings = await Rating.find({ doctorId: doctor._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('rating reviewText createdAt');

    const formattedRatings = ratings.map((r) => ({
      _id: r._id,
      rating: r.rating,
      reviewText: r.reviewText,
      patientFirstName: 'Patient', // Anonymous label
      createdAt: r.createdAt,
    }));

    return res.status(200).json({
      success: true,
      summary: {
        doctorId: doctor._id,
        fullName: doctor.fullName,
        averageRating: doctor.averageRating || 0,
        totalReviews: doctor.totalReviews || 0,
      },
      ratings: formattedRatings,
    });
  } catch (error) {
    next(error);
  }
};
