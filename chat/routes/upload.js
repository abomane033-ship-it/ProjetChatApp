const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), (req, res) => {
  res.json({
    name: req.file.originalname,
    path: `/uploads/${req.file.filename}`
  });
});

module.exports = router;
