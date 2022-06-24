import Sequelize, { Model, STRING, DECIMAL, ENUM, TEXT, BOOLEAN, DATE } from 'sequelize';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite3'
});

class Profile extends Model {}
Profile.init(
  {
    firstName: {
      type: STRING,
      allowNull: false
    },
    lastName: {
      type: STRING,
      allowNull: false
    },
    profession: {
      type: STRING,
      allowNull: false
    },
    balance:{
      type:DECIMAL(12,2)
    },
    type: {
      type: ENUM('client', 'contractor')
    }
  },
  {
    sequelize,
    modelName: 'Profile'
  }
);

class Contract extends Model {}
Contract.init(
  {
    terms: {
      type: TEXT,
      allowNull: false
    },
    status:{
      type: ENUM('new','in_progress','terminated')
    }
  },
  {
    sequelize,
    modelName: 'Contract'
  }
);

class Job extends Model {}
Job.init(
  {
    description: {
      type: TEXT,
      allowNull: false
    },
    price:{
      type: DECIMAL(12,2),
      allowNull: false
    },
    paid: {
      type: BOOLEAN,
      default:false
    },
    paymentDate:{
      type: DATE
    }
  },
  {
    sequelize,
    modelName: 'Job'
  }
);

Profile.hasMany(Contract, {as :'Contractor',foreignKey:'ContractorId'})
Contract.belongsTo(Profile, {as: 'Contractor'})
Profile.hasMany(Contract, {as : 'Client', foreignKey:'ClientId'})
Contract.belongsTo(Profile, {as: 'Client'})
Contract.hasMany(Job)
Job.belongsTo(Contract)

export {
  sequelize,
  Profile,
  Contract,
  Job
};
