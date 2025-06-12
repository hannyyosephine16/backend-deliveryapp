require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Driver, Store } = require('../models');
const nodemailer = require('nodemailer');
const response = require('../utils/response');
const { saveBase64Image } = require('../utils/imageHelper');
const { logger } = require('../utils/logger');

/**
 * Fungsi untuk menghasilkan token JWT
 */
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

/**
 * Objek untuk menyimpan token reset password
 */
const resetTokens = {};

/**
 * Fungsi untuk melakukan login
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const login = async (req, res) => {
    try {
        logger.info('Login attempt:', { email: req.body.email });
        const { email, password } = req.body;
        const user = await User.findOne({
            where: { email },
            include: [
                {
                    model: Driver,
                    as: 'driver',
                    required: false,
                    attributes: { exclude: ['createdAt', 'updatedAt'] }
                },
                {
                    model: Store,
                    as: 'store',
                    required: false,
                    attributes: { exclude: ['createdAt', 'updatedAt'] }
                }
            ]
        });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            logger.warn('Login failed: Invalid credentials', { email });
            return response(res, { statusCode: 401, message: 'Email atau password salah' });
        }

        const token = generateToken(user);
        const userData = user.get({ plain: true });
        delete userData.password;

        // Struktur response berdasarkan role
        let responseData = { token, user: userData };

        if (user.role === 'driver' && user.driver) {
            responseData.driver = user.driver;
        } else if (user.role === 'store' && user.store) {
            responseData.store = user.store;
        }

        logger.info('Login successful', { userId: user.id, role: user.role });
        return response(res, {
            statusCode: 200,
            message: 'Login berhasil',
            data: responseData
        });
    } catch (error) {
        logger.error('Login error:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat login',
            errors: error.message
        });
    }
};

/**
 * Fungsi untuk melakukan registrasi
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const register = async (req, res) => {
    try {
        logger.info('Registration attempt:', { email: req.body.email, role: req.body.role });
        const { name, email, phone, password, role } = req.body;
        const validRole = ['customer', 'store', 'driver', 'admin'];
        if (!validRole.includes(role)) {
            logger.warn('Registration failed: Invalid role', { role });
            return response(res, { statusCode: 400, message: 'Role tidak valid' });
        }
        const userRole = validRole.includes(role) ? role : 'customer';
        const hashedPassword = bcrypt.hashSync(password, 10);
        const user = await User.create({ name, email, phone, password: hashedPassword, role: userRole });

        logger.info('Registration successful', { userId: user.id, role: user.role });
        return response(res, { statusCode: 201, message: 'User berhasil didaftarkan', data: user });
    } catch (error) {
        logger.error('Registration error:', { error: error.message, stack: error.stack });
        return response(res, { statusCode: 500, message: 'Terjadi kesalahan saat registrasi', errors: error.message });
    }
};

/**
 * Get Profile - Mendapatkan data profil berdasarkan role user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getProfile = async (req, res) => {
    try {
        logger.info('Get profile request:', { userId: req.user.id, role: req.user.role });
        const userId = req.user.id;
        const userRole = req.user.role;

        // Data dasar yang akan diambil
        const includeOptions = [];

        // Tambahkan relasi berdasarkan role
        switch (userRole) {
            case 'driver':
                includeOptions.push({
                    model: Driver,
                    as: 'driver',
                    attributes: { exclude: ['createdAt', 'updatedAt'] }
                });
                break;
            case 'store':
                includeOptions.push({
                    model: Store,
                    as: 'store',
                    attributes: { exclude: ['createdAt', 'updatedAt'] }
                });
                break;
            case 'admin':
                // Admin bisa melihat semua data user
                includeOptions.push(
                    {
                        model: Driver,
                        as: 'driver',
                        attributes: { exclude: ['createdAt', 'updatedAt'] },
                        required: false
                    },
                    {
                        model: Store,
                        as: 'store',
                        attributes: { exclude: ['createdAt', 'updatedAt'] },
                        required: false
                    }
                );
                break;
            // Untuk customer tidak perlu include tambahan
        }

        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password', 'createdAt', 'updatedAt'] },
            include: includeOptions
        });

        if (!user) {
            logger.warn('Profile not found:', { userId });
            return response(res, { statusCode: 404, message: 'User tidak ditemukan' });
        }

        logger.info('Profile retrieved successfully', { userId });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan profil',
            data: user
        });

    } catch (error) {
        logger.error('Get profile error:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil profil',
            errors: error.message
        });
    }
};

/**
 * Lupa Password - Mengirim email dengan token reset password
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const forgotPassword = async (req, res) => {
    try {
        logger.info('Forgot password request:', { email: req.body.email });
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            logger.warn('Forgot password: Email not found', { email });
            return response(res, { statusCode: 404, message: 'Email tidak terdaftar' });
        }

        // Generate token reset password (berlaku 1 jam)
        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        resetTokens[user.id] = resetToken; // Simpan sementara

        // Kirim email reset password (gunakan nodemailer)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reset Password',
            text: `Gunakan link berikut untuk reset password: ${process.env.FRONTEND_URL}/reset-password/${resetToken}`
        };

        await transporter.sendMail(mailOptions);

        logger.info('Password reset email sent:', { userId: user.id });
        return response(res, { statusCode: 200, message: 'Email reset password telah dikirim' });
    } catch (error) {
        logger.error('Forgot password error:', { error: error.message, stack: error.stack });
        return response(res, { statusCode: 500, message: 'Terjadi kesalahan', errors: error.message });
    }
};

/**
 * Reset Password - Memproses token dan mengubah password
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const resetPassword = async (req, res) => {
    try {
        logger.info('Reset password attempt');
        const { token, newPassword } = req.body;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!resetTokens[decoded.id] || resetTokens[decoded.id] !== token) {
            logger.warn('Reset password: Invalid token');
            return response(res, { statusCode: 400, message: 'Token tidak valid atau kadaluarsa' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.update({ password: hashedPassword }, { where: { id: decoded.id } });

        delete resetTokens[decoded.id];

        logger.info('Password reset successful', { userId: decoded.id });
        return response(res, { statusCode: 200, message: 'Password berhasil diubah' });
    } catch (error) {
        logger.error('Reset password error:', { error: error.message, stack: error.stack });
        return response(res, { statusCode: 500, message: 'Terjadi kesalahan', errors: error.message });
    }
};

/**
 * Update Profil - User dapat mengubah nama, email, password, dan avatar
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const updateProfile = async (req, res) => {
    try {
        logger.info('Update profile request:', { userId: req.user.id });
        const { name, email, password, avatar } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return response(res, { statusCode: 404, message: 'User tidak ditemukan' });
        }

        const updateData = { name, email };

        // Jika ada password, hash terlebih dahulu
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Jika ada avatar dalam format Base64, simpan sebagai file
        if (avatar) {
            const avatarPath = saveBase64Image(avatar, 'users', 'avatar');
            updateData.avatar = avatarPath;
        }

        await user.update(updateData);

        logger.info('Profile updated successfully', { userId: req.user.id });
        return response(res, { statusCode: 200, message: 'Profil berhasil diperbarui', data: user });
    } catch (error) {
        logger.error('Update profile error:', { error: error.message, stack: error.stack });
        return response(res, { statusCode: 500, message: 'Terjadi kesalahan', errors: error.message });
    }
};

/**
 * Logout - Menghapus token dari frontend (hanya hapus di sisi frontend)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const logout = async (req, res) => {
    try {
        logger.info('Logout request:', { userId: req.user.id });
        // Implementasi logout jika diperlukan
        return response(res, { statusCode: 200, message: 'Logout berhasil' });
    } catch (error) {
        logger.error('Logout error:', { error: error.message, stack: error.stack });
        return response(res, { statusCode: 500, message: 'Terjadi kesalahan', errors: error.message });
    }
};

module.exports = {
    login,
    register,
    getProfile,
    forgotPassword,
    resetPassword,
    updateProfile,
    logout
};