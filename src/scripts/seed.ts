import mongoose from 'mongoose';
import { User, UserRole, UserStatus } from '../models/User';
import { Channel, ChannelPurpose, ChannelLanguage, ChannelType, ChannelCountry, EditType } from '../models/Channel';
import { Video, VideoStatus } from '../models/Video';
import { hashPassword } from '../utils/password';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Script de seed pour populer la base de données avec des données de test
 *
 * Usage: npm run seed
 */

async function seed() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Nettoyer la base de données
    logger.info('Cleaning database...');
    await User.deleteMany({});
    await Channel.deleteMany({});
    await Video.deleteMany({});

    logger.info('Creating users...');

    // Créer des utilisateurs
    const adminPassword = await hashPassword('admin123');
    const videaste1Password = await hashPassword('videaste123');
    const videaste2Password = await hashPassword('videaste123');
    const assistantPassword = await hashPassword('assistant123');

    const admin = await User.create({
      username: 'admin',
      email: 'admin@shorthub.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailNotifications: true,
      whatsappNotifications: false,
      whatsappLinked: false,
    });

    const videaste1 = await User.create({
      username: 'videaste1',
      email: 'videaste1@shorthub.com',
      password: videaste1Password,
      role: UserRole.VIDEASTE,
      status: UserStatus.ACTIVE,
      emailNotifications: true,
      whatsappNotifications: false,
      whatsappLinked: false,
      createdBy: admin._id,
    });

    const videaste2 = await User.create({
      username: 'videaste2',
      email: 'videaste2@shorthub.com',
      password: videaste2Password,
      role: UserRole.VIDEASTE,
      status: UserStatus.ACTIVE,
      emailNotifications: true,
      whatsappNotifications: false,
      whatsappLinked: false,
      createdBy: admin._id,
    });

    const assistant1 = await User.create({
      username: 'assistant1',
      email: 'assistant1@shorthub.com',
      password: assistantPassword,
      role: UserRole.ASSISTANT,
      status: UserStatus.ACTIVE,
      emailNotifications: true,
      whatsappNotifications: false,
      whatsappLinked: false,
      createdBy: admin._id,
    });

    // Assigner l'assistant au vidéaste1
    videaste1.assignedTo = assistant1._id as mongoose.Types.ObjectId;
    await videaste1.save();

    logger.info(`Created ${4} users`);

    logger.info('Creating channels...');

    // Créer des chaînes sources (pour roller)
    const sourceChannels = [
      {
        youtubeUrl: 'https://youtube.com/@ExampleChannel1',
        channelId: 'UCExampleChannel1',
        username: '@ExampleChannel1',
        subscriberCount: 150000,
        language: ChannelLanguage.VF,
        country: ChannelCountry.FRANCE,
        editType: EditType.SANS_EDIT,
        channelPurpose: ChannelPurpose.SOURCE,
        type: ChannelType.MIX,
        domain: 'Gaming',
      },
      {
        youtubeUrl: 'https://youtube.com/@ExampleChannel2',
        channelId: 'UCExampleChannel2',
        username: '@ExampleChannel2',
        subscriberCount: 250000,
        language: ChannelLanguage.VA,
        country: ChannelCountry.USA,
        editType: EditType.SANS_EDIT,
        channelPurpose: ChannelPurpose.SOURCE,
        type: ChannelType.ONLY,
        domain: 'Comedy',
      },
      {
        youtubeUrl: 'https://youtube.com/@ExampleChannel3',
        channelId: 'UCExampleChannel3',
        username: '@ExampleChannel3',
        subscriberCount: 500000,
        language: ChannelLanguage.VF,
        country: ChannelCountry.FRANCE,
        editType: EditType.AVEC_EDIT,
        channelPurpose: ChannelPurpose.SOURCE,
        type: ChannelType.MIX,
        domain: 'Tech',
      },
    ];

    const createdSourceChannels = await Channel.insertMany(sourceChannels);

    // Créer des chaînes de publication (nos chaînes)
    const publicationChannels = [
      {
        youtubeUrl: 'https://youtube.com/@MyChannelVF',
        channelId: 'UCMyChannelVF',
        username: '@MyChannelVF',
        subscriberCount: 10500,
        language: ChannelLanguage.VF,
        country: ChannelCountry.FRANCE,
        editType: EditType.AVEC_EDIT,
        channelPurpose: ChannelPurpose.PUBLICATION,
        type: ChannelType.MIX,
        ownedBy: videaste1._id,
        subscriberHistory: [
          { count: 10000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          { count: 10250, date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
          { count: 10500, date: new Date() },
        ],
      },
      {
        youtubeUrl: 'https://youtube.com/@MyChannelVA',
        channelId: 'UCMyChannelVA',
        username: '@MyChannelVA',
        subscriberCount: 8200,
        language: ChannelLanguage.VA,
        country: ChannelCountry.USA,
        editType: EditType.AVEC_EDIT,
        channelPurpose: ChannelPurpose.PUBLICATION,
        type: ChannelType.MIX,
        ownedBy: videaste2._id,
        subscriberHistory: [
          { count: 8000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          { count: 8100, date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
          { count: 8200, date: new Date() },
        ],
      },
    ];

    const createdPublicationChannels = await Channel.insertMany(publicationChannels);

    logger.info(`Created ${createdSourceChannels.length + createdPublicationChannels.length} channels`);

    logger.info('Creating videos...');

    // Créer des vidéos
    const videos = [];

    // Vidéos rollées mais pas encore assignées
    for (let i = 0; i < 5; i++) {
      videos.push({
        sourceChannelId: createdSourceChannels[i % 3]._id,
        sourceVideoUrl: `https://youtube.com/shorts/rolled${i + 1}`,
        rolledAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000),
        status: VideoStatus.ROLLED,
        title: `Vidéo rollée ${i + 1}`,
        tags: ['short', 'test'],
      });
    }

    // Vidéos assignées
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    videos.push({
      sourceChannelId: createdSourceChannels[0]._id,
      sourceVideoUrl: 'https://youtube.com/shorts/assigned1',
      rolledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      assignedTo: videaste1._id,
      assignedBy: admin._id,
      assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      publicationChannelId: createdPublicationChannels[0]._id,
      scheduledDate: tomorrow,
      status: VideoStatus.IN_PROGRESS,
      title: 'Vidéo en cours - demain',
      tags: ['urgent'],
      notes: 'Vidéo importante à publier demain',
    });

    videos.push({
      sourceChannelId: createdSourceChannels[1]._id,
      sourceVideoUrl: 'https://youtube.com/shorts/assigned2',
      rolledAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      assignedTo: videaste1._id,
      assignedBy: admin._id,
      assignedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      publicationChannelId: createdPublicationChannels[0]._id,
      scheduledDate: in3Days,
      status: VideoStatus.ASSIGNED,
      title: 'Vidéo assignée - dans 3 jours',
      tags: ['short'],
    });

    videos.push({
      sourceChannelId: createdSourceChannels[2]._id,
      sourceVideoUrl: 'https://youtube.com/shorts/assigned3',
      rolledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      assignedTo: videaste2._id,
      assignedBy: admin._id,
      assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      publicationChannelId: createdPublicationChannels[1]._id,
      scheduledDate: in7Days,
      status: VideoStatus.ASSIGNED,
      title: 'Vidéo assignée - dans 7 jours',
      tags: ['short', 'viral'],
      notes: 'Penser à ajouter des effets spéciaux',
    });

    // Vidéos complétées
    videos.push({
      sourceChannelId: createdSourceChannels[0]._id,
      sourceVideoUrl: 'https://youtube.com/shorts/completed1',
      rolledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      assignedTo: videaste1._id,
      assignedBy: admin._id,
      assignedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      publicationChannelId: createdPublicationChannels[0]._id,
      scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: VideoStatus.COMPLETED,
      title: 'Vidéo complétée en attente de validation',
      tags: ['completed'],
    });

    // Vidéos validées
    videos.push({
      sourceChannelId: createdSourceChannels[1]._id,
      sourceVideoUrl: 'https://youtube.com/shorts/validated1',
      rolledAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      assignedTo: videaste2._id,
      assignedBy: admin._id,
      assignedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      publicationChannelId: createdPublicationChannels[1]._id,
      scheduledDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      validatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: VideoStatus.VALIDATED,
      title: 'Vidéo validée prête à publier',
      tags: ['validated'],
      adminFeedback: 'Excellent travail !',
    });

    // Vidéo publiée
    videos.push({
      sourceChannelId: createdSourceChannels[2]._id,
      sourceVideoUrl: 'https://youtube.com/shorts/published1',
      rolledAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      assignedTo: videaste1._id,
      assignedBy: admin._id,
      assignedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
      publicationChannelId: createdPublicationChannels[0]._id,
      scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      validatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      status: VideoStatus.PUBLISHED,
      title: 'Vidéo publiée avec succès',
      tags: ['published', 'success'],
    });

    await Video.insertMany(videos);

    logger.info(`Created ${videos.length} videos`);

    logger.info('✅ Database seeded successfully!');
    logger.info('');
    logger.info('Login credentials:');
    logger.info('  Admin: admin / admin123');
    logger.info('  Vidéaste 1: videaste1 / videaste123');
    logger.info('  Vidéaste 2: videaste2 / videaste123');
    logger.info('  Assistant 1: assistant1 / assistant123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
