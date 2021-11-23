const express = require('express');

function createUser(req, res) {
  users.find({/*insert query*/});
}

const app = express();
const router = express.Router();

router.post('/user', createUser);
app.use('/', router);
