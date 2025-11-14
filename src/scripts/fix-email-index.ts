/* eslint-disable no-console */
// Script to fix email index - make it sparse to allow multiple null values
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shorthub';

async function fixEmailIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db?.collection('users');

    if (!usersCollection) {
      throw new Error('Users collection not found');
    }

    console.log('\nCurrent indexes:');
    const indexes = await usersCollection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index)}`);
    });

    // Drop the old email index
    console.log('\nDropping old email_1 index...');
    try {
      await usersCollection.dropIndex('email_1');
      console.log('✓ Old index dropped');
    } catch (err: unknown) {
      const isIndexNotFound =
        (err && typeof err === 'object' && 'code' in err && err.code === 27) ||
        (err instanceof Error && err.message.includes('index not found'));

      if (isIndexNotFound) {
        console.log('✓ Index does not exist (already dropped or never created)');
      } else {
        throw err;
      }
    }

    // Create new sparse unique index on email
    console.log('\nCreating new sparse unique index on email...');
    await usersCollection.createIndex(
      { email: 1 },
      {
        unique: true,
        sparse: true,
        name: 'email_1'
      }
    );
    console.log('✓ New sparse index created');

    console.log('\nNew indexes:');
    const newIndexes = await usersCollection.indexes();
    newIndexes.forEach((index) => {
      console.log(`  - ${JSON.stringify(index)}`);
    });

    console.log('\n✅ Email index fixed successfully!');
    console.log('Users can now be created without email (email: null)');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing email index:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixEmailIndex();
