const express = require('express');
const router = express.Router();
const bulkUserController = require('../controllers/Masters/BulkUser');

// Bulk Insert Users
router.post('/bulkInsertUsers', bulkUserController.bulkInsertUsers);

// GET All Users
router.get('/getUsers', bulkUserController.getUsers);

// UPDATE User
router.put('/updateUser/:id', bulkUserController.updateUser);

// UPDATE Single User
router.put('/updateSingleUser/:id', bulkUserController.updateSingleUser);

// DELETE User
router.delete('/deleteUsers', bulkUserController.deleteUsers);

module.exports = router;
