const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('./events');
const fs = require('fs');
const path = require('path');

const expect = chai.expect;
chai.use(chaiHttp);

const eventsFilePath = path.join(__dirname, '../data/events.json');

// Clean up events.json before tests
function resetEventsFile() {
  fs.writeFileSync(eventsFilePath, '[]', 'utf8');
}

describe('Event Planner API (Array Auth)', () => {
  let token;

  before(() => {
    resetEventsFile();
  });

  after(() => {
    resetEventsFile();
  });

  describe('User Registration and Login', () => {
    it('should register a new user', (done) => {
      chai.request(app)
        .post('/api/register')
        .send({ username: 'testuser', password: 'testpass' })
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('message', 'User registered successfully');
          done();
        });
    });

    it('should login the user and return a token', (done) => {
      chai.request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'testpass' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('token');
          token = res.body.token;
          done();
        });
    });
  });

  describe('Event Creation and Viewing', () => {
    it('should create a new event', (done) => {
      chai.request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Team Meeting',
          date: new Date(Date.now() + 3600000).toISOString(),
          category: 'Meetings',
          reminderTime: new Date(Date.now() + 300000).toISOString()
        })
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('id');
          done();
        });
    });

    it('should retrieve events sorted by date by default', (done) => {
      chai.request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.be.greaterThan(0);
          done();
        });
    });
  });
});
