import dotenv from 'dotenv';

// Charge .env une seule fois, avant tout autre module applicatif.
// Les imports ES etant hisses, ce module doit rester sans dependance interne
// pour pouvoir etre importe en premier par n'importe quel autre.
dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} est requis et n'est pas defini. Voir .env.example ; en Docker, il est fourni par docker-compose.yml.`
    );
  }
  return value;
};

export const env = {
  databaseUrl: required('DATABASE_URL'),
  // Aucune valeur par defaut : un secret de repli code en dur permettrait de
  // forger n'importe quel token si la variable venait a manquer.
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '1h',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',

  // Stockage objet (MinIO, compatible S3). Fourni par docker-compose.yml.
  // Absent en developpement et en test : le service de stockage bascule
  // alors sur une implementation en memoire, sans quoi la suite de tests
  // exigerait un MinIO en marche.
  minioEndpoint: process.env.MINIO_ENDPOINT,
  minioAccessKey: process.env.MINIO_ACCESS_KEY,
  minioSecretKey: process.env.MINIO_SECRET_KEY,
  minioUseSsl: process.env.MINIO_USE_SSL === 'true',
  mediaBucket: process.env.MEDIA_BUCKET ?? 'five-media',
};
