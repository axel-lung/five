# Five/Futsal V0 - Startup and Testing Guide (with Traefik)

This guide will help you start the application using Traefik as a reverse proxy for HTTPS termination and domain-based routing (five.alng.fr), and test the core functionality to validate that V0 successfully addresses the core problem.

## 🚀 Quick Start Summary

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env to set your passwords (optional but recommended)
#    - DB_PASSWORD
#    - MINIO_PASSWORD  
#    - JWT_SECRET

# 3. Ensure you have a domain pointing to this machine's IP:
#    - five.alng.fr should resolve to your server's public IP
#    - For local testing, you can add to /etc/hosts:
#        <your-server-ip> five.alng.fr

# 4. Start all services (includes Traefik)
docker-compose up -d

# 5. Wait for initialization (1-2 minutes)
#    Check status with: docker-compose ps
#    Traefik will obtain SSL certificates from Let's Encrypt (if domain is public and accessible)

# 6. Access the application via HTTPS
#    Frontend: https://five.alng.fr
#    Traefik Dashboard: http://<server-ip>:8080 (optional)
#    API: https://five.alng.fr/api
#    MinIO Console: http://<server-ip>:9001 (optional, not exposed via Traefik by default)

# 7. Test the core flows (see detailed steps below)

# 8. When done:
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

### Step 2: Domain Configuration
For Traefik to work with HTTPS, you need a domain pointing to your machine:

**Option A: Public Domain (Recommended for production-like testing)**
- Ensure you own `alng.fr` or a subdomain
- Create an A record: `five.alng.fr` → `<your-server-public-IP>`
- Wait for DNS propagation (can take minutes to hours)
- Make sure ports 80 and 443 are open in your firewall

**Option B: Local Testing (using /etc/hosts)**
On your local machine (where you'll browse), add to `/etc/hosts`:
```
<your-server-IP> five.alng.fr
```
Replace `<your-server-IP>` with the actual IP of the machine running Docker.
Note: This only works on the machine where you edit the hosts file.

### Step 3: Start Services
```bash
docker-compose up -d
```

### Step 4: Wait for Initialization
On first startup, services need time to initialize:
- PostgreSQL: Creates database and runs init script
- Backend: Installs dependencies, builds TypeScript, starts server
- Frontend: Installs dependencies, builds React app
- MinIO: Creates storage buckets
- Traefik: Starts and obtains SSL certificates (if using public domain)

Check progress:
```bash
docker-compose ps
docker-compose logs -f traefik   # Watch Traefik startup and certificate acquisition
docker-compose logs -f backend   # Follow backend logs
docker-compose logs -f frontend  # Follow frontend logs
```

Services are ready when:
- All show "healthy" or "Up" in `docker-compose ps`
- Traefik logs show "Certificate acquired" for your domain (if public)
- Backend logs show "Server is running on port 3000"
- Frontend is served via Traefik at https://five.alng.fr

### Step 5: Access the Application
- **Frontend**: https://five.alng.fr
- **Backend API**: https://five.alng.fr/api (health check at https://five.alng.fr/api/health)
- **Traefik Dashboard**: http://<server-ip>:8080 (if exposed, optional)
- **MinIO Console**: http://<server-ip>:9001 (login: minioadmin / your MINIO_PASSWORD) - *not proxied by Traefik in this config*
- **PostgreSQL**: localhost:5432 (database: five, user: five_user, password: from .env)

## 🧪 Testing Core Functionality

Follow these steps to validate that V0 solves the core problem described in CCH.md:

### Test 1: User Account Creation & Authentication
1. Go to https://five.alng.fr
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
3. Login with a second account (use a different browser or incognito)
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

✅ **Account Creation Flow**: Users can register and login securely via HTTPS  
✅ **Group Creation & Management**: Organizers can create groups and manage members  
✅ **Event Lifecycle**: Events can be created with date/time/location/capacity, users can join/waitlist  
✅ **Navigation & Discovery**: Users can browse upcoming events via secure domain  
✅ **Data Persistence**: Information survives container restarts  
✅ **Docker Readiness**: All services run in containers with proper volume mounting and Traefik reverse proxy  
✅ **Security**: Traffic encrypted via Let's Encrypt certificates (for public domains)  

## 📚 Prochaines Étapes

Selon les résultats de vos tests et la validation avec votre groupe de Reims (comme indiqué dans le plan des 90 jours du CCH.md) :

1. **Recueillir des retours** : Faites tester par 2-3 organisateurs/joueurs réels via https://five.alng.fr
2. **Mesurer l'activation** : Combien créent des groupes/events après inscription ?
3. **Décider de la suite** : Selon la validation, poursuivre vers V1.5 (paiement + FiveComposer) ou ajuster

## 🛑 Arrêt et Nettoyage

```bash
# Arrêter mais garder les données
docker-compose down

# Arrêter ET supprimer toutes les données (à utiliser avec précaution !)
docker-compose down -v

# Voir les logs pour déboguer
docker-compose logs traefik
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
docker-compose logs minio
```

## 💡 Conseil pour une Validation Réussie

Concentrez-vous sur la résolution des **"quatre douleurs réelles"** identifiées dans le CCH.md (même si certaines seront traitées en V1.5) :
1. **Collecter l'argent** → À venir en V1.5 (paiement conditionnel)
2. **Compléter la liste** → Testez la fonctionnalité de liste d'attente
3. **Organiser/relancer** → Testez la gestion de groupes et d'événements + notifications de base
4. **Équilibrer les équipes** → À venir en V1.5 (FiveComposer)

Si ces flux de base fonctionnent et répondent aux besoins principaux d'organisation de sessions de five, alors votre validation V0 est réussie et vous pouvez décider en connaissance de cause d'investir dans V1.5 et au-delà.

**Bonne validation !** 🎯

---

## 📝 Notes Importantes sur Traefik et HTTPS

### Certificats SSL
- Avec un domaine public et un email valide, Traefik obtient automatiquement des certificats Let's Encrypt
- Les certificats sont stockés dans `acme.json` (veillez à ce que ce fichier ait les permissions 600)
- Pour les tests locaux avec `/etc/hosts`, vous aurez des erreurs de certificat (domaine non correspondant) - vous pouvez passer outre dans le navigateur pour les tests

### Sécurité
- Ne jamais commettre `.env` avec de vrais mots de passe
- En production, considérez l'utilisation de Docker secrets ou d'un gestionnaire de secrets externe
- Le tableau de bord Traefik (`:8080`) est exposé par défaut - vous pouvez le désactiver ou le sécuriser en production

### Dépannage Courant

**"502 Bad Gateway"**
- Vérifiez que le service backend/frontend est healthy: `docker-compose ps`
- Vérifiez les labels Traefik dans docker-compose.yml
- Regardez les logs de Traefik: `docker-compose logs traefik`

"Certificate not found"
- Pour les domaines publics: assurez-vous que les ports 80/443 sont accessibles depuis l'extérieur
- Vérifiez que votre email est correctement configuré dans traefik.yml
- Attendez quelques minutes après le démarrage - la acquisition de certificat peut prendre du temps

"Site can't be reached"
- Vérifiez que votre domaine pointe bien vers l'IP du serveur
- Testez avec `curl -I https://five.alng.fr` depuis une machine externe
- Vérifiez que le pare-feu autorise les entrées sur les ports 80 et 443

## 🔄 Workflow avec GitHub

Puisque votre projet est sur GitHub, vous pouvez facilement le mettre à jour sur les deux machines :

```bash
# Sur chaque machine:
git pull origin main   # Récupérer les dernières modifications
# Puis redémarrer si nécessaire:
docker-compose up -d --build
```

---