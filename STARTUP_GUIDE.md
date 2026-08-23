# Five/Futsal V0 - Startup and Testing Guide

This guide will help you start the application and test the core functionality to validate that V0 successfully addresses the core problem.

## 🚀 Quick Start Summary

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env to set your passwords (optional but recommended)
#    - DB_PASSWORD
#    - MINIO_PASSWORD  
#    - JWT_SECRET

# 3. Start all services
docker-compose up -d

# 4. Wait for initialization (1-2 minutes)
#    Check status with: docker-compose ps

# 5. Access the application
#    Frontend: http://localhost:3000
#    API Docs: http://localhost:3001/api (if you add Swagger later)
#    MinIO Console: http://localhost:9001

# 6. Test the core flows (see detailed steps below)

# 7. When done:
docker-compose down          # Stop services
docker-compose down -v       # Stop and delete all data
```

## 🔧 Detailed Setup Instructions

### Step 1: Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` to set secure passwords:
```dotenv
DB_PASSWORD=your_secure_postgres_password
MINIO_PASSWORD=your_secure_minio_password
JWT_SECRET=a_very_long_and_random_string_for_jwt_signing
```

### Step 2: Start Services
```bash
docker-compose up -d
```

### Step 3: Wait for Initialization
On first startup, services need time to initialize:
- PostgreSQL: Creates database and runs init script
- Backend: Installs dependencies, builds TypeScript, starts server
- Frontend: Installs dependencies, builds React app
- MinIO: Creates storage buckets

Check progress:
```bash
docker-compose ps
docker-compose logs -f backend  # Follow backend logs
docker-compose logs -f frontend # Follow frontend logs
```

Services are ready when:
- All show "healthy" in docker-compose ps
- Backend logs show "Server is running on port 3000"
- Frontend logs show Vite dev server ready (if using dev mode) or nginx serving static files

### Step 4: Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001 (health check at http://localhost:3001/health)
- **MinIO Console**: http://localhost:9001 (login: minioadmin / your MINIO_PASSWORD)
- **PostgreSQL**: localhost:5432 (database: five, user: five_user, password: from .env)

## 🧪 Testing Core Functionality

Follow these steps to validate that V0 solves the core problem described in CCH.md:

### Test 1: User Account Creation & Authentication
1. Go to http://localhost:3000
2. Click "S'inscrire" (Register)
3. Fill in:
   - Email: test@example.com
   - Password: testpassword123
   - First Name: Test
   - Last Name: User
   - City: Reims
4. Click "S'inscrire"
5. You should be redirected to the dashboard
6. Verify you see your name in the welcome message

### Test 2: Group Creation & Management
1. From dashboard, click "Créer un groupe"
2. Fill in:
   - Nom du groupe: Groupe Five Reims
   - Description: Groupe de five historique de Reims pour tester l'application
   - Ville: Reims
   - Type d'accès: Privé (invitation seulement)
3. Click "Créer le groupe"
4. You should see the group listed under "Mes groupes"
5. Click on the group to view details
6. Verify you see the group information and that you're listed as owner

### Test 3: Event Creation & Participation
1. From dashboard, click "Créer un événement"
2. Fill in:
   - Titre de l'événement: Session Five Hebdomadaire de Test
   - Description: Test de l'application V0 avec le groupe de Reims
   - Date et heure: Select a date/time in the future
   - Lieu: Complexe Sportif Colbert, Reims
   - Capacité: 12
   - Niveau: intermédiaire
   - Prix: 10.00
   - Groupe associé: [Leave blank or enter your group ID if you want to test group association]
3. Click "Créer l'événement"
4. You should see the event listed under "Événements à venir"
5. Click on the event to view details
6. Click "Participer à l'événement" (Join Event)
7. Verify your status changes to "Participant confirmé" or similar
8. Check that the participant count increases

### Test 4: Waitlist Functionality (Optional)
To test waitlist:
1. Create an event with capacity of 1
2. Join the event with your first account (should get confirmed)
3. Login with a second account
4. Try to join the same event
5. Verify you get waitlist status
6. Have the first account leave the event
7. Verify the second account automatically gets confirmed (if implemented) or can now join

### Test 5: Navigation & Discovery
1. From dashboard, browse the events list
2. Verify you can see your created event
3. Test date filtering if implemented
4. Verify shareable link concept exists (each event has a UUID token)

### Test 6: Data Persistence
1. Stop all services: `docker-compose down`
2. Start again: `docker-compose up -d`
3. Wait for initialization
4. Login with your test account
5. Verify your groups and events are still there

## 📊 Verification Checklist

After completing the tests, verify that V0 successfully addresses the core problem:

✅ **Account Creation Flow**: Users can register and login securely  
✅ **Group Creation & Management**: Organizers can create groups and manage members  
✅ **Event Lifecycle**: Events can be created with date/time/location/capacity, users can join/waitlist  
✅ **Navigation & Discovery**: Users can browse upcoming events  
✅ **Data Persistence**: Information survives container restarts  
✅ **Docker Readiness**: All services run in containers with proper volume mounting  

## 🔍 Troubleshooting Common Issues

### "Connection refused" errors
- Wait longer for services to initialize
- Check specific service logs: `docker-compose logs [service-name]`
- Verify ports aren't conflicting with other applications

### Database connection errors
- Check PostgreSQL service is healthy: `docker-compose ps`
- Verify DATABASE_URL in backend/.env matches docker-compose service
- Check backend logs for connection details

### Frontend not showing data
- Check browser console for JavaScript errors (F12 → Console)
- Verify API calls are succeeding in Network tab
- Check that REACT_APP_API_URL is correctly set (if using .env in frontend)

### Authentication issues
- Clear localStorage or use incognito mode to test fresh login
- Check that JWT_SECRET is consistent between backend and any middleware
- Verify tokens are being stored and sent correctly

### File upload issues (if implementing later)
- Verify MinIO service is running
- Check that MinIO credentials in backend/.env match the service
- Ensure bucket permissions are correct

## 📝 Notes for Validation

According to CCH.md section 4.2 (Plan des 90 premiers jours), V0 validation should include:
- ✅ Prototype cliquable (clickable prototype) - Achieved through functional React UI
- ✅ Test de création d'événement et inscription - Tested above
- ✅ Landing page - Available at http://localhost:3000
- ✅ Groupe de Reims connecté - Can be simulated with test data
- ✅ Instrumentation d'événements et activation - Through API endpoints and UI feedback

## 🔄 Next Steps After Validation

Once you've validated that V0 successfully addresses the core problem:
1. Collect feedback from test users (organisateurs et joueurs)
2. Measure activation and retention metrics
3. Decide whether to proceed to V1.5 based on validation results
4. Consider adding:
   - Payment processing (V1.5)
   - FiveComposer/team generation (V1.5)
   - Advanced social features (V2)
   - Premium features (V1.5+)

## 🛑 Stopping and Cleaning Up

```bash
# Stop services but keep data
docker-compose down

# Stop services and delete all data (use with caution!)
docker-compose down -v

# View service logs for debugging
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
docker-compose logs minio
```

## 💡 Tips for Successful Validation

1. **Test with realistic scenarios**: Try to replicate how you'd actually use the app for organizing five sessions
2. **Involve potential users**: If possible, have 2-3 friends test the registration, group creation, and event joining flows
3. **Focus on pain points**: Pay special attention to whether the app solves the "quatre douleurs réelles" from CCH.md:
   - Collecter l'argent (deferred to V1.5)
   - Compléter la liste (tested via waitlist)
   - Organiser / relancer (tested via group/event management)
   - Équilibrer les équipes (deferred to V1.5 FourComposer)
4. **Keep it simple**: V0 is about validation, not perfection. Focus on whether the core concept works.

---

**Rappel**: L'objectif de V0 est de "tester le problème avant de construire" (CCH.md ligne 682). Si ces flux de base fonctionnent et résolvent les problèmes principaux d'organisation de sessions de five, alors vous avez réussi votre validation et pouvez décider en connaissance de cause d'investir dans V1.5 et au-delà.

Bonne validation! 🎯