import { Sequelize } from 'sequelize';
import User from './user';
import Group from './group';
import Event from './event';
import EventInscription from './eventInscription';
import GroupMember from './groupMember';

// Initialize Sequelize connection
const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://five_user:five_password@localhost:5432/five',
  {
    dialect: 'postgres',
    logging: false, // Set to console.log to see SQL queries
  }
);

// Initialize models
const db: any = {};

db.User = User.init(sequelize);
db.Group = Group.init(sequelize);
db.Event = Event.init(sequelize);
db.EventInscription = EventInscription.init(sequelize);
db.GroupMember = GroupMember.init(sequelize);

// Set up associations
Object.values(db).forEach((model: any) => {
  if (model.associate) {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize };
export default db;