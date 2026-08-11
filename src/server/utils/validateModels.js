import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import {
  User,
  Patient,
  Doctor,
  Staff,
  Clinic,
  Specialty,
  Appointment,
  QueueEntry,
  QueueCounter,
  DoctorSchedule,
  QueueHistory,
  Rating,
} from '../models/index.js';

dotenv.config();

export const runModelValidation = async () => {
  console.log('--- Phase 02 Model Schema Validation Starting ---');

  // 1. Verify Imports & Registration
  const models = [
    { name: 'User', model: User },
    { name: 'Patient', model: Patient },
    { name: 'Doctor', model: Doctor },
    { name: 'Staff', model: Staff },
    { name: 'Clinic', model: Clinic },
    { name: 'Specialty', model: Specialty },
    { name: 'Appointment', model: Appointment },
    { name: 'QueueEntry', model: QueueEntry },
    { name: 'QueueCounter', model: QueueCounter },
    { name: 'DoctorSchedule', model: DoctorSchedule },
    { name: 'QueueHistory', model: QueueHistory },
    { name: 'Rating', model: Rating },
  ];

  console.log(`✓ All ${models.length} models imported successfully.`);

  // 2. Invariant Check: Staff model userId uniqueness & clinicId index
  const staffIndexes = Staff.schema.indexes();
  const hasStaffUserIdUnique = staffIndexes.some(([fields, options]) => {
    return fields.userId === 1 && options?.unique === true;
  });
  if (!hasStaffUserIdUnique) {
    throw new Error('INVARIANT VIOLATION: Staff model missing unique index on userId!');
  }
  console.log('✓ Invariant Verified: Staff unique index on userId confirmed.');

  // 3. Invariant Check: Appointment must NOT contain tokenNumber
  const appointmentPaths = Object.keys(Appointment.schema.paths);
  if (appointmentPaths.includes('tokenNumber')) {
    throw new Error('INVARIANT VIOLATION: Appointment schema must NOT contain tokenNumber!');
  }
  console.log('✓ Invariant Verified: Appointment schema does NOT contain tokenNumber.');

  // 4. Invariant Check: QueueEntry appointmentId must NOT be required (walk-in compatibility)
  const appointmentIdPath = QueueEntry.schema.path('appointmentId');
  if (appointmentIdPath.isRequired) {
    throw new Error('INVARIANT VIOLATION: QueueEntry.appointmentId must be optional for walk-in support!');
  }
  console.log('✓ Invariant Verified: QueueEntry.appointmentId is optional (walk-in supported).');

  // 5. Invariant Check: QueueCounter compound index
  const queueCounterIndexes = QueueCounter.schema.indexes();
  const hasQueueCounterCompoundIndex = queueCounterIndexes.some(([fields, options]) => {
    return (
      fields.clinicId === 1 &&
      fields.doctorId === 1 &&
      fields.date === 1 &&
      options?.unique === true
    );
  });
  if (!hasQueueCounterCompoundIndex) {
    throw new Error('INVARIANT VIOLATION: QueueCounter missing compound unique index on clinicId + doctorId + date!');
  }
  console.log('✓ Invariant Verified: QueueCounter compound unique index on clinicId + doctorId + date confirmed.');

  // 6. Invariant Check: Rating uniqueness per queueEntryId
  const ratingIndexes = Rating.schema.indexes();
  const hasRatingUniqueIndex = ratingIndexes.some(([fields, options]) => {
    return fields.queueEntryId === 1 && options?.unique === true;
  });
  if (!hasRatingUniqueIndex) {
    throw new Error('INVARIANT VIOLATION: Rating missing unique index on queueEntryId!');
  }
  console.log('✓ Invariant Verified: Rating unique index per queueEntryId confirmed.');

  // 7. Connect to MongoDB Atlas and build/sync schema indexes
  await connectDB();
  console.log(`✓ Connected to Database: ${mongoose.connection.host}/${mongoose.connection.name}`);

  for (const { name, model } of models) {
    await model.syncIndexes(); // Automatically synchronizes model indexes with Atlas
    console.log(`✓ Model [${name}] compiled and indexes synchronized.`);
  }

  // Clean up connection cleanly
  await mongoose.disconnect();
  console.log('✓ Validation complete. Database disconnected cleanly.');
  console.log('--- Phase 02 Model Schema Validation Completed Successfully ---');
};

if (process.argv[1] && process.argv[1].endsWith('validateModels.js')) {
  runModelValidation().catch((err) => {
    console.error('Validation Error:', err);
    process.exit(1);
  });
}
