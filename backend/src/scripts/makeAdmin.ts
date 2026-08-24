import { UserModel as User, sequelize } from '../models';
import { audit } from '../services/audit';

/**
 * B-01 : promouvoir un compte administrateur.
 *
 * Deliberement hors API : aucune route ne doit permettre de se promeuvoir,
 * ce serait une escalade de privileges a une requete. Passer par ce script
 * exige un acces a la base, donc au serveur.
 *
 *   npm run make-admin -- alice@example.com
 *   npm run make-admin -- alice@example.com --revoke
 */
const main = async () => {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');

  if (!email) {
    console.error('Usage: npm run make-admin -- <email> [--revoke]');
    process.exit(1);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`Aucun compte pour ${email}`);
    process.exit(1);
  }

  const role = revoke ? 'user' : 'admin';
  await user.update({ role } as any);

  // L'acteur est null : l'action vient de la ligne de commande, pas d'un
  // compte connecte. Elle doit tout de meme laisser une trace (B-06).
  await audit(null, revoke ? 'admin.role.revoke' : 'admin.role.grant', 'user', user.id, {
    email,
  });

  console.log(`${email} a desormais le role "${role}".`);
  await sequelize.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
