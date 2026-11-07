import { Router } from 'express';
import { getPrivateMedia } from '../controllers/private-media.controller';
const router = Router();
router.get('/private/:fileId', getPrivateMedia);
export default router;
