import { Specialty } from '../models/index.js';

/**
 * @desc    Get all active specialties (or all for Admin)
 * @route   GET /api/specialties
 * @access  Public / Protected
 */
export const getSpecialties = async (req, res, next) => {
  try {
    const filter = req.user && req.user.role === 'ADMIN' ? {} : { isActive: true };
    const specialties = await Specialty.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: specialties.length,
      specialties,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create specialty (Admin only)
 * @route   POST /api/admin/specialties
 * @access  Private (ADMIN)
 */
export const createSpecialty = async (req, res, next) => {
  try {
    const { name, code, description, iconName } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Specialty name and unique code are required',
      });
    }

    const normalizedCode = code.toUpperCase().trim();

    const existing = await Specialty.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Specialty code "${normalizedCode}" already exists`,
      });
    }

    const specialty = await Specialty.create({
      name: name.trim(),
      code: normalizedCode,
      description: description ? description.trim() : null,
      iconName: iconName ? iconName.trim() : null,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Specialty created successfully',
      specialty,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update specialty (Admin only)
 * @route   PATCH /api/admin/specialties/:id
 * @access  Private (ADMIN)
 */
export const updateSpecialty = async (req, res, next) => {
  try {
    const { name, code, description, iconName, isActive } = req.body;

    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({
        success: false,
        message: 'Specialty not found',
      });
    }

    if (code) {
      const normalizedCode = code.toUpperCase().trim();
      if (normalizedCode !== specialty.code) {
        const existing = await Specialty.findOne({ code: normalizedCode });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: `Specialty code "${normalizedCode}" already exists`,
          });
        }
        specialty.code = normalizedCode;
      }
    }

    if (name) specialty.name = name.trim();
    if (description !== undefined) specialty.description = description ? description.trim() : null;
    if (iconName !== undefined) specialty.iconName = iconName ? iconName.trim() : null;
    if (typeof isActive === 'boolean') specialty.isActive = isActive;

    await specialty.save();

    return res.status(200).json({
      success: true,
      message: 'Specialty updated successfully',
      specialty,
    });
  } catch (error) {
    next(error);
  }
};
