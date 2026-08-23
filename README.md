# Five/Futsal V0 - Dockerized Application

This is the V0 (proof/validation) version of the Five/Futsal application, designed to validate the core problem with a minimal functional implementation that can be run entirely with Docker.

## Features Implemented (V0 Scope)

- ✅ User authentication (email/password + JWT)
- ✅ Group creation and management
- ✅ Event creation and management  
- ✅ Event joining/waitlist functionality
- ✅ User profile management
- ✅ Basic event listing and discovery
- ✅ Responsive React frontend
- ✅ RESTful Node.js/TypeScript backend
- ✅ PostgreSQL database
- ✅ MinIO for file storage (S3-compatible)
- ✅ Nginx reverse proxy

## Prerequisites

- Docker and Docker Compose installed on your machine
- At least 4GB of RAM recommended for all services to run smoothly

## Quick Start

1. **Clone this repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd five
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` to set your preferred passwords:
   - `DB_PASSWORD` - PostgreSQL password
   - `MINIO_PASSWORD` - MinIO console password  
   - `JWT_SECRET` - Secret for JWT token generation (change this in production!)

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to initialize** (this may take 1-2 minutes on first start):
   - Backend API: http://localhost:3001
   - Frontend: http://localhost:3000
   - MinIO Console: http://localhost:9001 (login with minioadmin / your MINIO_PASSWORD)
   - PostgreSQL: localhost:5432

5. **Access the application**:
   - Open your browser to: http://localhost:3000
   - Register a new account or login with test credentials (if sample data was loaded)

## Test Credentials (if sample data loaded)

If you uncommented the sample data in `init-scripts/db.init.sql`:
- Email: organisateur@reims.fr
- Password: secret

## Services Overview

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | React application |
| Backend API | http://localhost:3001/api | REST API endpoints |
| PostgreSQL | localhost:5432 | Primary database |
| MinIO (API) | localhost:9000 | File storage (S3-compatible) |
| MinIO Console | http://localhost:9001 | Web UI for MinIO |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile

### Groups
- `GET /api/groups` - Get all groups
- `POST /api/groups` - Create new group
- `GET /api/groups/:id` - Get group by ID
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/members` - Add member to group
- `DELETE /api/groups/:id/members` - Remove member from group
- `GET /api/groups/:id/members` - Get group members

### Events
- `GET /api/events` - Get all events (filter by ?date=YYYY-MM-DD)
- `POST /api/events` - Create new event
- `GET /api/events/:id` - Get event by ID
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/join` - Join event (creates inscription)
- `POST /api/events/:id/leave` - Leave event (cancel inscription)
- `GET /api/events/:id/participants` - Get event participants

## Development

### Backend
```bash
cd backend
npm install
npm run dev  # Runs with ts-node-dev for hot reloading
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Runs Vite dev server on http://localhost:5173
```

## Testing the Core Flows

To validate that V0 successfully addresses the core problem:

1. **Account Creation**
   - Register a new user
   - Verify you can login with the new credentials

2. **Group Creation & Management**
   - Create a new group (e.g., "Groupe Five Reims")
   - Invite another user (you can use a second test account)
   - Verify the member appears in the group

3. **Event Lifecycle**
   - Create an event with date, time, location, capacity
   - Verify the event appears in the events list
   - Join the event as another user
   - Verify waitlist functionality when capacity is exceeded
   - Check that organizers can see participant lists

4. **Navigation & Discovery**
   - Browse upcoming events
   - Test date filtering
   - Verify shareable links concept (implemented as UUID tokens)

## Stopping and Cleaning Up

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes all data!)
docker-compose down -v

# View logs
docker-compose logs -f [service-name]  # e.g., docker-compose logs -f backend
```

## Notes for Future Development (V1.5+)

This V0 intentionally excludes features planned for later versions:
- ❌ Payment processing (Stripe Connect)
- ❌ FiveComposer/team generation
- ❌ Advanced social features (group feed, chat)
- ❌ Premium features (Pass Leader subscription)
- ❌ Advanced notifications (email, push)
- ❌ Partner integrations
- ❌ Tournaments and merchandise

These can be added in subsequent versions while maintaining backward compatibility with the V0 data model.

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports 3000, 3001, 5432, 9000, or 9001 are in use, either:
   - Stop the conflicting services
   - Modify the port mappings in docker-compose.yml

2. **Database connection errors**: 
   - Ensure the PostgreSQL service is healthy: `docker-compose ps`
   - Check backend logs: `docker-compose logs backend`
   - Verify the DATABASE_URL in .env matches the docker-compose service

3. **MinIO connection errors**:
   - Verify MinIO service is running: `docker-compose ps`
   - Check that MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY in .env match the service

4. **Frontend not connecting to backend**:
   - Check that REACT_APP_API_URL in frontend/.env (if used) points to correct backend URL
   - Verify nginx proxy configuration forwards /api/ requests to backend

### Getting Help

Check the logs for each service:
```bash
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
docker-compose logs minio
docker-compose logs nginx
```

## License

MIT License - see LICENSE file for details.

## Acknowledgments

Built as a Dockerized validation prototype for the Five/Futsal project based on the CCH.md specification.