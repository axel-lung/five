import crypto from 'crypto';
import { env } from '../config/env';

/**
 * C-02 / G-01 : stockage des images de profil et de groupe.
 *
 * MinIO n'est pas expose publiquement dans docker-compose.yml — seule sa
 * console l'est, et en local uniquement. Les objets ne sont donc pas
 * joignables par le navigateur : l'API les ressert elle-meme via
 * GET /api/media/:key, qui passe par la route Traefik /api deja en place.
 * Aucun changement d'infrastructure n'est necessaire.
 */
export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface Storage {
  save(body: Buffer, contentType: string, extension: string): Promise<string>;
  get(key: string): Promise<StoredObject | null>;
}

/**
 * Implementation en memoire, pour le developpement et les tests.
 *
 * Sans elle, la suite de tests exigerait un MinIO en marche pour un simple
 * upload d'avatar.
 */
const memoryStorage = (): Storage => {
  const objects = new Map<string, StoredObject>();

  return {
    async save(body, contentType, extension) {
      const key = `${crypto.randomUUID()}${extension}`;
      objects.set(key, { body, contentType });
      return key;
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
  };
};

/** Implementation S3, utilisee avec MinIO en production. */
const s3Storage = (): Storage => {
  // aws-sdk n'est charge que si MinIO est configure : en test, l'exiger
  // ralentirait le demarrage pour rien.
  const AWS = require('aws-sdk');

  const client = new AWS.S3({
    endpoint: `${env.minioUseSsl ? 'https' : 'http'}://${env.minioEndpoint}`,
    accessKeyId: env.minioAccessKey,
    secretAccessKey: env.minioSecretKey,
    // MinIO ne sert pas les buckets en sous-domaine.
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
  });

  // Le bucket est cree au premier usage plutot qu'au demarrage : le backend
  // ne doit pas refuser de demarrer parce que MinIO n'est pas encore pret.
  let bucketReady: Promise<void> | null = null;
  const ensureBucket = () => {
    if (!bucketReady) {
      bucketReady = client
        .headBucket({ Bucket: env.mediaBucket })
        .promise()
        .catch(() => client.createBucket({ Bucket: env.mediaBucket }).promise())
        .then(() => undefined);
    }
    return bucketReady;
  };

  return {
    async save(body, contentType, extension) {
      await ensureBucket();
      const key = `${crypto.randomUUID()}${extension}`;

      await client
        .putObject({ Bucket: env.mediaBucket, Key: key, Body: body, ContentType: contentType })
        .promise();

      return key;
    },

    async get(key) {
      await ensureBucket();
      try {
        const object = await client
          .getObject({ Bucket: env.mediaBucket, Key: key })
          .promise();

        return {
          body: object.Body as Buffer,
          contentType: object.ContentType ?? 'application/octet-stream',
        };
      } catch {
        return null;
      }
    },
  };
};

export const storage: Storage =
  env.minioEndpoint && env.nodeEnv !== 'test' ? s3Storage() : memoryStorage();
