import express, { json } from "express";
import cors from "cors";
import connection from "./database.js";
import joi from "joi";

const app = express();
app.use(cors());
app.use(json());

const categorySchema = joi.object({
	name: joi.string().required(),
});
const gamesSchema = joi.object({
	name: joi.string().required(),
	image: joi.required(),
	stockTotal: joi.number().integer().min(1).required(),
	categoryId: joi.number().required(),
	pricePerDay: joi.number().integer().min(1).required(),
});
const gameQuerySchema = joi.object({
	name: joi.string().required(),
});

app.get("/categories", async (_req, res) => {
	try {
		const categories = await connection.query("SELECT * FROM categories;");
		res.status(201).send(categories.rows);
	} catch (error) {
		console.log(error);
	}
});
app.post("/categories", async (req, res) => {
	const category = req.body;

	const validation = categorySchema.validate(category, { abortEarly: true });
	if (validation.error) {
		return res
			.sendStatus(400)
			.send({ message: "There must be a category to add" });
	}

	try {
		const existingCategory = await connection.query(
			"SELECT * FROM categories where name = $1;",
			[category.name]
		);
		if (existingCategory.rows.length > 0) {
			return res.status(409).send({ message: "The category already exists" });
		}

		await connection.query("INSERT INTO categories (nome) VALUES ($1);", [
			category.name,
		]);
		res.sendStatus(201);
	} catch (error) {
		console.log(error);
	}
});

app.get("/games", async (req, res) => {
	const game = req.query;
	const validation = gameQuerySchema.validate(game, { abortEarly: true });

	if (validation.error) {
		return res
			.sendStatus(400)
			.send({ message: "There must be a category to add" });
	}

	try {
		if (game.name) {
			const filteredGames = await connection.query(
				`SELECT g.*, c.name as "categoryName" FROM games as g JOIN categories as c ON g."categoryId" = c.id WHERE name LIKE '($1)%';`,
				[game.name]
			);
			return res.status(201).send(filteredGames.rows);
		}

		const newGamesTable = await connection.query(
			'SELECT g.*, c.name as "categoryName" FROM games as g JOIN categories as c ON g."categoryId" = c.id;'
		);
		res.status(201).send(newGamesTable.rows);
	} catch (error) {
		console.log(error);
	}
});
app.post("/games", async (req, res) => {
	const game = req.body;
	const validation = gamesSchema.validate(game, { abortEarly: true });

	if (validation.error) return res.sendStatus(400);

	try {
		const cateroryExists = await connection.query(
			"SELECT * FROM categories WHERE id = $1;",
			[game.categoryId]
		);
		if (cateroryExists.rows === 0) return res.sendStatus(400);

		const gameAlreadyExists = await connection.query(
			"SELECT * FROM games WHERE name = $1;",
			[game.name]
		);
		if (gameAlreadyExists.rows > 0) return res.sendStatus(409);

		await connection.query(
			"INSERT INTO games (name, image, stockTotal, categoryId, pricePerDay) VALUES ($1, $2, $3, $4, $5))",
			[
				game.name,
				game.image,
				game.stockTotal,
				game.categoryId,
				game.pricePerDay,
			]
		);
		res.status(201).send({ message: "New game added" });
	} catch (error) {
		console.loog(error);
	}
});

export default app;
