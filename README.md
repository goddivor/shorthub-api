# ShortHub API - GraphQL Backend

Backend GraphQL pour ShortHub, la plateforme de gestion collaborative de YouTube Shorts.

## 🎯 Vue d'Ensemble

API GraphQL complète construite avec:
- **Apollo Server** - Serveur GraphQL
- **MongoDB + Mongoose** - Base de données
- **TypeScript** - Type safety
- **GraphQL Subscriptions** - Temps réel via WebSocket
- **JWT** - Authentification
- **DataLoader** - Optimisation des requêtes

## 📋 Prérequis

- Node.js >= 18.x
- MongoDB (local ou Railway)
- npm ou yarn

## 🚀 Installation

### 1. Installer les dépendances

```bash
cd server
npm install
```

### 2. Configuration de l'environnement

Copier le fichier `.env.example` et le renommer en `.env`:

```bash
cp .env.example .env
```

Configurer les variables dans `.env`:

```env
# Server
NODE_ENV=development
PORT=4000

# MongoDB (Railway ou local)
MONGODB_URI=mongodb://localhost:27017/shorthub

# JWT Secrets (changer en production!)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# YouTube API
YOUTUBE_API_KEY=your-youtube-api-key

# Email (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Twilio WhatsApp (optionnel)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Démarrage

**Mode développement:**
```bash
npm run dev
```

**Mode production:**
```bash
npm run build
npm start
```

Le serveur sera accessible sur:
- **GraphQL Endpoint:** http://localhost:4000/graphql
- **GraphQL Playground:** http://localhost:4000/graphql
- **WebSocket (Subscriptions):** ws://localhost:4000/graphql
- **Health Check:** http://localhost:4000/health

## 👤 Utilisateur par défaut

Au premier démarrage, un compte admin est créé automatiquement:

- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@shorthub.com`

⚠️ **Important:** Changez ce mot de passe immédiatement après la première connexion!

## 📚 Utilisation de l'API GraphQL

### Authentification

Toutes les requêtes (sauf `login`) nécessitent un token JWT dans le header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Exemple de requêtes

**Login:**
```graphql
mutation Login {
  login(username: "admin", password: "admin123") {
    token
    refreshToken
    user {
      id
      username
      email
      role
    }
  }
}
```

**Obtenir son profil:**
```graphql
query Me {
  me {
    id
    username
    email
    role
    stats {
      totalVideosAssigned
      totalVideosCompleted
      completionRate
    }
  }
}
```

**Lister les chaînes:**
```graphql
query GetChannels {
  channels(first: 20, purpose: SOURCE) {
    edges {
      node {
        id
        username
        subscriberCount
        language
        channelPurpose
      }
    }
    totalCount
  }
}
```

**Créer un utilisateur (Admin):**
```graphql
mutation CreateUser {
  createUser(input: {
    username: "videaste1"
    email: "videaste1@example.com"
    password: "password123"
    role: VIDEASTE
    emailNotifications: true
  }) {
    id
    username
    role
  }
}
```

**Assigner une vidéo (Admin):**
```graphql
mutation AssignVideo {
  assignVideo(input: {
    videoId: "VIDEO_ID"
    videasteId: "USER_ID"
    publicationChannelId: "CHANNEL_ID"
    scheduledDate: "2025-01-20T10:00:00Z"
    notes: "Vidéo importante à faire avant le 20"
  }) {
    id
    status
    scheduledDate
    assignedTo {
      username
    }
  }
}
```

**Calendrier des vidéos:**
```graphql
query GetCalendar {
  calendarVideos(
    startDate: "2025-01-01T00:00:00Z"
    endDate: "2025-01-31T23:59:59Z"
  ) {
    id
    title
    scheduledDate
    status
    isLate
    sourceChannel {
      username
    }
    assignedTo {
      username
    }
  }
}
```

**Subscription (Notifications en temps réel):**
```graphql
subscription OnNotification {
  notificationReceived(userId: "USER_ID") {
    id
    type
    message
    video {
      id
      title
    }
    createdAt
  }
}
```

## 🏗️ Structure du Projet

```
server/
├── src/
│   ├── config/              # Configuration (env, database)
│   ├── models/              # Modèles Mongoose
│   ├── graphql/
│   │   ├── schema.graphql   # Schéma GraphQL
│   │   ├── resolvers/       # Resolvers
│   │   ├── scalars/         # Scalars personnalisés (DateTime, JSON)
│   │   └── directives/      # Directives custom
│   ├── services/            # Logique métier
│   ├── dataloaders/         # DataLoaders (optimisation N+1)
│   ├── middlewares/         # Middlewares (auth, permissions)
│   ├── utils/               # Utilitaires (jwt, password, logger)
│   ├── jobs/                # Cron jobs & queues
│   ├── context.ts           # Context GraphQL
│   └── index.ts             # Point d'entrée
├── logs/                    # Logs du serveur
├── package.json
├── tsconfig.json
└── .env
```

## 🔐 Rôles et Permissions

### ADMIN (Créateur)
- Toutes les permissions
- Créer/bloquer utilisateurs
- Gérer toutes les chaînes
- Roller et assigner des vidéos
- Voir analytics complets

### VIDEASTE
- Voir ses vidéos assignées
- Marquer vidéos comme complétées
- Assigner vidéos à son assistant
- Gérer ses chaînes de publication
- Commenter sur vidéos

### ASSISTANT
- Voir vidéos assignées par son vidéaste
- Marquer vidéos comme complétées
- Commenter sur vidéos

## 📊 Modèles de Données

### User
- username, email, password
- role: ADMIN | VIDEASTE | ASSISTANT
- status: ACTIVE | BLOCKED
- Notifications: email, WhatsApp
- Relations: createdBy, assignedTo

### Channel
- YouTube info (url, channelId, username, subscribers)
- Classification: language, country, editType
- channelPurpose: SOURCE | PUBLICATION
- subscriberHistory

### Video
- Source et publication channels
- Assignment: vidéaste, date planifiée
- Status: ROLLED → ASSIGNED → IN_PROGRESS → COMPLETED → VALIDATED → PUBLISHED
- Dates: rolledAt, assignedAt, completedAt, validatedAt, publishedAt

### Notification
- Type: VIDEO_ASSIGNED, DEADLINE_REMINDER, VIDEO_COMPLETED, etc.
- Canaux: email, WhatsApp
- read status

## 🧪 Tests

```bash
npm test
```

## 📝 Scripts Disponibles

```bash
npm run dev          # Développement avec hot-reload
npm run build        # Build TypeScript
npm start            # Production
npm run lint         # ESLint
npm run type-check   # Vérification types TypeScript
```

## 🚢 Déploiement sur Railway

### 1. Créer projet Railway

```bash
# Installer Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialiser
railway init
```

### 2. Ajouter MongoDB

Dans le dashboard Railway:
1. New → Database → MongoDB
2. Copier `MONGODB_URI` depuis les variables d'environnement

### 3. Configurer variables d'environnement

Dans Railway, ajouter toutes les variables du `.env`:
- `NODE_ENV=production`
- `PORT` (Railway le définit automatiquement)
- `MONGODB_URI` (depuis le service MongoDB)
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- Etc.

### 4. Déployer

```bash
railway up
```

L'API sera accessible sur l'URL fournie par Railway.

## 🔧 Troubleshooting

### Erreur de connexion MongoDB

```bash
# Vérifier MongoDB local
mongosh

# Ou vérifier la connexion Railway
# Dans .env, vérifier MONGODB_URI
```

### Port déjà utilisé

```bash
# Changer le PORT dans .env
PORT=4001
```

### Erreurs TypeScript

```bash
npm run type-check
```

## 📖 Documentation

- [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL](https://graphql.org/learn/)
- [Mongoose](https://mongoosejs.com/docs/)
- [Railway Docs](https://docs.railway.app/)

## 🤝 Contribution

Voir le fichier `CONTRIBUTING.md` (à créer)

## 📄 Licence

MIT
