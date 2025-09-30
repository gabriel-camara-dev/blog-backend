import { type FastifyRequest, type FastifyReply } from 'fastify'
import { z } from 'zod'
import { env } from '../../../env'
import { InvalidCredentialsError } from '../../../use-cases/errors/invalid-credentials-error'
import { makeAuthenticateUseCase } from '../../../use-cases/factories/make-authenticate-use-case'
import { UserPresenter } from '../../presenters/user-presenter'

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authenticateBodySchema = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
    })
    .parse(request.body)

  const { email, password } = authenticateBodySchema
  const { ip: ipAddress } = request
  const { 'user-agent': browser } = request.headers
  const { remotePort } = request.socket

  try {
    const authenticateUseCase = makeAuthenticateUseCase()

    const browserName = Array.isArray(browser) ? browser[0] : browser

    const { user } = await authenticateUseCase.execute({
      email,
      password,
      ipAddress,
      browser: browserName,
      remotePort: `${remotePort}`,
    })

    const accessToken = await reply.jwtSign(
      {},
      {
        sign: {
          sub: user?.publicId,
        },
      }
    )

    const refreshToken = await reply.jwtSign(
      {},
      {
        sign: {
          sub: user?.publicId,
          expiresIn: '7d',
        },
      }
    )

    return await reply
      .setCookie('refreshToken', refreshToken, {
        path: '/',
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        httpOnly: true,
      })
      .status(200)
      .send({ user: UserPresenter.toHTTP(user), accessToken })
  } catch (err: unknown) {
    if (err instanceof InvalidCredentialsError) {
      return await reply.status(400).send({ message: err.message })
    }

    throw err
  }
}
