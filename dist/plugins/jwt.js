import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { config } from '../config.js';
import { unauthorized } from '../shared/errors.js';
export default fp(async (app) => {
    app.register(fjwt, {
        secret: config.jwt.accessSecret,
    });
    app.decorate('authenticate', async (req, reply) => {
        try {
            await req.jwtVerify();
        }
        catch {
            return unauthorized(reply, 'Invalid or expired token');
        }
    });
});
//# sourceMappingURL=jwt.js.map