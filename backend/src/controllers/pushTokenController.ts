import { Request, Response, NextFunction } from 'express';
import { PushTokenModel as PushToken } from '../models';

/**
 * N-01 : enregistrement d'un appareil.
 *
 * Le meme jeton peut revenir pour un autre compte — un telephone revendu, un
 * appareil partage. On met alors a jour le proprietaire au lieu de refuser le
 * doublon : sans cela, l'ancien proprietaire continuerait de recevoir les
 * notifications du nouveau.
 */
export const registerPushToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { token, platform, timezone } = req.body;

    const [device, created] = await PushToken.findOrCreate({
      where: { token },
      defaults: { userId, token, platform, timezone: timezone ?? null },
    });

    if (!created) {
      await device.update({ userId, platform, timezone: timezone ?? null });
    }

    res.status(created ? 201 : 200).json({ message: 'Device registered' });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrait d'un appareil, a la deconnexion.
 *
 * Le filtre porte aussi sur l'utilisateur : un compte ne peut pas desinscrire
 * l'appareil d'un autre en devinant son jeton.
 */
export const unregisterPushToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const deleted = await PushToken.destroy({
      where: { userId, token: req.params.token },
    });

    if (deleted === 0) {
      return res.status(404).json({ message: 'Device not found' });
    }

    res.json({ message: 'Device unregistered' });
  } catch (error) {
    next(error);
  }
};
