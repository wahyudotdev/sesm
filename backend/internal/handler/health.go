package handler

import "github.com/gofiber/fiber/v2"

// Health returns a liveness response.
func Health(c *fiber.Ctx) error {
	return ok(c, fiber.Map{"status": "ok"})
}
