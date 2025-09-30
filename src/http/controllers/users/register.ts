import { type FastifyRequest, type FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeRegisterUseCase } from '../../../use-cases/factories/make-register-use-case'
import { UserAlreadyExistsError } from '../../../use-cases/errors/user-already-exists-error'
import { UserPresenter } from '../../presenters/user-presenter'

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const registerBodySchema = z
    .object({
      name: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
    })
    .parse(request.body)

  const { name, email, password } = registerBodySchema

  try {
    const registerUserCase = makeRegisterUseCase()

    const { user } = await registerUserCase.execute({
      name,
      email,
      password,
    })

    return await reply.status(201).send({ user: UserPresenter.toHTTP(user) })
  } catch (err: unknown) {
    if (err instanceof UserAlreadyExistsError) {
      return await reply.status(400).send({ message: err.message })
    }

    throw err
  }
}