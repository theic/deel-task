import express from 'express';
import bodyParser from 'body-parser';
import { sequelize } from './model.js';
import { getProfile, parseProfile } from './middleware/index.js';
import { Op } from 'sequelize';

const app = express();

app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

app.use(getProfile);
app.use(parseProfile);

app.get('/contracts/:contractId', async (req, res) => {
  const { Contract } = req.app.get('models');
  const { contractId } = req.params;
  const { ClientId, ContractorId } = req.profile;

  const contract = await Contract.findOne({
    where: {
      id: contractId,
      [Op.or]: [{
        ClientId,
      }, {
        ContractorId,
      }]
    }
  });

  if (!contract) {
    return res.status(404).end();
  }

  res.json(contract);
});

app.get('/contracts', async (req, res) => {
  const { Contract } = req.app.get('models');
  const { ClientId, ContractorId } = req.profile;

  const contracts = await Contract.findAll({
    where: {
      [Op.not]: {
        status: 'terminated',
      },
      [Op.or]: [{
        ClientId,
      }, {
        ContractorId,
      }]
    }
  });

  res.json(contracts);
});

app.get('/jobs/unpaid', async (req, res) => {
  const { Job, Contract } = req.app.get('models');
  const { ClientId, ContractorId } = req.profile;

  const jobs = await Job.findAll({
    where: {
      [Op.or]: [{
        paid: {
          [Op.is]: null,
        },
      }, {
        paid: false,
      }]
    },
    include: [{
      model: Contract,
      where: {
        status: 'in_progress',
        [Op.or]: [{
          ClientId,
        }, {
          ContractorId,
        }],
      }
    }],
  });

  res.json(jobs);
});

app.post('/jobs/:jobId/pay', async (req, res) => {
  const { Job, Contract } = req.app.get('models');
  const { ClientId, ContractorId, balance } = req.profile;
  const { jobId } = req.params;

  if (ClientId === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Designed for clients only'
    });
    return;
  }

  const job = await Job.findOne({
    where: {
      id: jobId,
    },
    include: [{
      model: Contract,
      where: {
        [Op.or]: [{
          ClientId,
        }, {
          ContractorId,
        }],
      }
    }],
  });

  if (balance < job.price) {
    res.status(400).json({
      status: 'error',
      message: 'Insufficient funds'
    });
    return;
  }

  if (job.paid === true) {
    res.status(400).json({
      status: 'error',
      message: 'You have already paid for the job'
    });
    return;
  }

  if (job.Contract.status !== 'in_progress') {
    res.status(400).json({
      status: 'error',
      message: 'Contract is not active',
    });
    return;
  }

  // TODO: make use of transaction

  await Profile.update({
    balance: balance - job.price,
  }, {
    where: {
      id: ClientId,
    }
  });

  await Job.update({
    paid: true,
    paymentDate: new Date().toISOString(),
  }, {
    where: {
      id: jobId,
    }
  });

  res.json({
    status: 'success',
  });
});

app.post('/balances/deposit/:userId', async (req, res) => {
  // TODO: not sure exactly what should I do here

  const { Profile } = req.app.get('models');
  const { balance } = req.profile;
  const { userId } = req.params;
  const { amount } = req.body;

  const [[result]] = await sequelize.query(`
    SELECT
      SUM(Jobs.price) as toPay
    FROM Jobs
    INNER JOIN Contracts ON Jobs.ContractId = Contracts.id
    INNER JOIN Profiles ON Contracts.ClientId = Profiles.id
    WHERE
      Contracts.ClientId = ?
      AND (Jobs.paid IS NULL OR Jobs.paid = false)
  `, {
    replacements: [
      userId,
    ],
  }).catch(error => console.error(error));

  const depositMax = (result && result.toPay * 0.25) || amount;
  let deposit = amount;
  if (amount > depositMax) {
    deposit = depositMax;
  }

  await Profile.update({
    balance: balance + deposit,
  }, {
    where: {
      id: userId,
    }
  });
  
  res.json({
    status: 'success',
  });
});

app.get('/admin/best-profession', async (req, res) => {
  const { start, end } = req.query;

  const [[result]] = await sequelize.query(`
    SELECT
      SUM(Jobs.price) as totalPaid,
      Profiles.profession as profession
    FROM Jobs
    INNER JOIN Contracts ON Jobs.ContractId = Contracts.id
    INNER JOIN Profiles ON Contracts.ContractorId = Profiles.id
    WHERE
      Jobs.paid = true
      AND (Jobs.paymentDate BETWEEN ? AND ?)
    GROUP BY profession
    ORDER BY totalPaid DESC
    LIMIT 1
  `, {
    replacements: [
      start,
      end,
    ],
  }).catch(error => console.error(error));

  res.json(result || {});
});

app.get('/admin/best-clients', async (req, res) => {
  const { start, end, limit = 2 } = req.query;

  const [result] = await sequelize.query(`
    SELECT
      Profiles.id as id,
      (Profiles.firstName || ' ' || Profiles.lastName) as fullName,
      SUM(Jobs.price) as paid
    FROM Jobs
    INNER JOIN Contracts ON Jobs.ContractId = Contracts.id
    INNER JOIN Profiles ON Contracts.ClientId = Profiles.id
    WHERE
      Jobs.paid = true
      AND (Jobs.paymentDate BETWEEN ? AND ?)
    GROUP BY clientId
    ORDER BY paid DESC
    LIMIT ?
  `, {
    replacements: [
      start,
      end,
      limit
    ],
  }).catch(error => console.error(error));

  res.json(result || []);
});

export default app;
