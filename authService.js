import 'dotenv/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUsersCollection } from './mongodbService.js';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secret';
const JWT_EXPIRES_IN = '7d';

export async function createUser({ email, password, nickname }) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Validate password length
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  
  const users = await getUsersCollection();
  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new Error('Email already registered');
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    email: email.toLowerCase().trim(),
    passwordHash,
    nickname: (nickname || '').trim(),
    instructions: '',
    createdAt: new Date()
  };
  
  try {
    const result = await users.insertOne(user);
    return { _id: result.insertedId, email: user.email, nickname: user.nickname, instructions: user.instructions };
  } catch (err) {
    // Handle MongoDB errors
    if (err.code === 11000) {
      throw new Error('Email already registered');
    }
    console.error('MongoDB insert error:', err);
    throw new Error(`Failed to create user: ${err.message}`);
  }
}

export async function verifyUser({ email, password }) {
  const users = await getUsersCollection();
  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) throw new Error('Invalid credentials');
  return { 
    _id: user._id, 
    email: user.email, 
    nickname: user.nickname || '',
    occupation: user.occupation || '',
    moreAboutYou: user.moreAboutYou || '',
    instructions: user.instructions || '',
    baseStyle: user.baseStyle || 'default',
    concise: user.concise || 'default',
    warm: user.warm || 'default',
    enthusiastic: user.enthusiastic || 'default',
    formal: user.formal || 'default',
    headersLists: user.headersLists || 'default',
    emoji: user.emoji || 'default',
    referenceSavedMemories: user.referenceSavedMemories !== false,
    referenceChatHistory: user.referenceChatHistory !== false
  };
}

export function signToken(user) {
  return jwt.sign({ userId: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function getUserById(userId) {
  const users = await getUsersCollection();
  const user = await users.findOne({ _id: typeof userId === 'string' ? new ObjectId(userId) : userId });
  if (!user) return null;
  return { 
    _id: user._id, 
    email: user.email, 
    nickname: user.nickname || '',
    occupation: user.occupation || '',
    moreAboutYou: user.moreAboutYou || '',
    instructions: user.instructions || '',
    baseStyle: user.baseStyle || 'default',
    concise: user.concise || 'default',
    warm: user.warm || 'default',
    enthusiastic: user.enthusiastic || 'default',
    formal: user.formal || 'default',
    headersLists: user.headersLists || 'default',
    emoji: user.emoji || 'default',
    referenceSavedMemories: user.referenceSavedMemories !== false,
    referenceChatHistory: user.referenceChatHistory !== false
  };
}

export async function updateProfile(userId, { 
  nickname,
  occupation,
  moreAboutYou,
  instructions,
  baseStyle,
  concise,
  warm,
  enthusiastic,
  formal,
  headersLists,
  emoji,
  referenceSavedMemories,
  referenceChatHistory
}) {
  const users = await getUsersCollection();
  const updateData = {
    nickname: nickname ?? '',
    occupation: occupation ?? '',
    moreAboutYou: moreAboutYou ?? '',
    instructions: instructions ?? '',
    baseStyle: baseStyle ?? 'default',
    concise: concise ?? 'default',
    warm: warm ?? 'default',
    enthusiastic: enthusiastic ?? 'default',
    formal: formal ?? 'default',
    headersLists: headersLists ?? 'default',
    emoji: emoji ?? 'default',
    referenceSavedMemories: referenceSavedMemories !== false,
    referenceChatHistory: referenceChatHistory !== false,
    updatedAt: new Date()
  };
  await users.updateOne(
    { _id: typeof userId === 'string' ? new ObjectId(userId) : userId },
    { $set: updateData }
  );
  return getUserById(userId);
}

