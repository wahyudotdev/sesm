package middleware

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// CORS returns a Fiber CORS middleware configured for the environment.
// In development, it allows the Vite dev server origin.
// In production (embedded), CORS is not needed.
func CORS() fiber.Handler {
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}

	return cors.New(cors.Config{
		AllowOrigins: origin,
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type,Authorization",
	})
}
