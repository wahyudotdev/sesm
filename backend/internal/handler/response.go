package handler

import "github.com/gofiber/fiber/v2"

// ok sends a successful JSON response.
func ok(c *fiber.Ctx, data any) error {
	return c.JSON(fiber.Map{"data": data, "error": nil})
}

// fail sends an error JSON response with the given HTTP status.
func fail(c *fiber.Ctx, status int, msg string) error {
	return c.Status(status).JSON(fiber.Map{"data": nil, "error": msg})
}
