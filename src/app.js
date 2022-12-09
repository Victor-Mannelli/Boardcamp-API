import express, { json } from "express";
import cors from "cors";
import connection from "./database.js";
import joi from "joi";
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(json());

const categorySchema = joi.object({
	name: joi.string().required(),
});
const gamesSchema = joi.object({
	name: joi.string().required(),
	image: joi.string().required(),
	stockTotal: joi.number().integer().min(1).required(),
	categoryId: joi.number().required(),
	pricePerDay: joi.number().integer().min(1).required(),
});
const gameQuerySchema = joi.object({
	name: joi.string().optional(),
});
const cpfQuerySchema = joi.object({
	cpf: joi.required(),
});
const idParamsSchema = joi.object({
	id: joi.required(),
});
const clientSchema = joi.object({
	name: joi.string().required(),
	phone: joi.string().min(11).required(),
	cpf: joi.string().min(11).required(),
	birthday: joi.date().required(),
});
const rentalSchema = joi.object({
	customerId: joi.number().required(),
	gameId: joi.number().required(),
	daysRented: joi.number().min(1).required(),
});

app.get("/categories", async (_req, res) => {
	try {
		const categories = await connection.query("SELECT * FROM categories;");
		res.status(200).send(categories.rows);
	} catch (error) {
		console.log(error);
	}
});
app.post("/categories", async (req, res) => {
	const category = req.body;

	const validation = categorySchema.validate(category, { abortEarly: true });
	if (validation.error) {
		return res.status(400).send({ message: "There must be a category to add" });
	}

	try {
		const existingCategory = await connection.query(
			"SELECT * FROM categories where name = $1;",
			[category.name]
		);
		if (existingCategory.rows.length > 0) {
			return res.status(409).send({ message: "The category already exists" });
		}

		await connection.query("INSERT INTO categories (name) VALUES ($1);", [
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
		return res.status(400).send({ message: "There must be a category to add" });
	}

	try {
		if (game.name) {
			const filteredGames = await connection.query(
				`SELECT g.*, c.name as "categoryName" FROM games as g JOIN categories as c ON g."categoryId" = c.id WHERE name LIKE '($1)%';`,
				[game.name]
			);
			return res.status(200).send(filteredGames.rows);
		}

		const newGamesTable = await connection.query(
			'SELECT g.*, c.name as "categoryName" FROM games as g JOIN categories as c ON g."categoryId" = c.id;'
		);
		res.status(200).send(newGamesTable.rows);
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
			'INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)',
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
		console.log(error);
	}
});

app.get("/customers", async (req, res) => {
	const cpf = req.query.cpf;
	const validation = cpfQuerySchema.validate(cpf, { abortEarly: true });

	if (validation.error) return res.sendStatus(422);
	try {
		if (cpf) {
			const filteredCustomers = await connection.query(
				"SELECT * FROM customers WHERE cpf LIKE $1%;",
				[cpf]
			);
			return res.status(200).send(filteredCustomers.rows);
		}

		const customers = await connection.query("SELECT * FROM customers;");
		res.status(200).send(customers.rows);
	} catch (error) {
		console.log(error);
	}
});
app.get("/customers/:id", async (req, res) => {
	const clientParams = req.params;
	const validation = idParamsSchema.validate(clientParams, {
		abortEarly: true,
	});

	if (validation.error) return res.sendStatus(400);

	try {
		const user = await connection.query(
			"SELECT * FROM customers WHERE id = $1;",
			[clientParams.id]
		);
		if (user.rows.length === 0) return res.sendStatus(404);
		res.send(user.rows);
	} catch (error) {
		console.log(error);
	}
});
app.post("/customers", async (req, res) => {
	const client = req.body;
	const validation = clientSchema.validate(client, { abortEarly: true });

	if (validation.error) return res.sendStatus(400);

	try {
		const clientAlreadyExists = await connection.query(
			"SELECT * FROM customers WHERE cpf = $1",
			[client.cpf]
		);
		if (clientAlreadyExists.rows.length !== 0) return res.sendStatus(409);

		await connection.query(
			"INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4);",
			[client.name, client.phone, client.cpf, client.birthday]
		);
		res.status(201).send({ message: "Client created" });
	} catch (error) {
		console.log(error);
	}
});
app.put("/customers/:id", async (req, res) => {
	const clientParams = req.params;
	const client = req.body;

	const paramsValidation = idParamsSchema.validate(clientParams, {
		abortEarly: true,
	});
	const bodyValidation = clientSchema.validate(client, { abortEarly: true });

	if (paramsValidation.error) return res.sendStatus(404);
	if (bodyValidation.error) return res.sendStatus(400);

	try {
		const cpfAlreadyInUse = await connection.query(
			"SELECT * FROM customers WHERE cpf = $1 AND id <> $2;",
			[client.cpf, clientParams.id]
		);
		if (cpfAlreadyInUse.rows.length !== 0) return res.sendStatus(409);

		await connection.query(
			"UPDATE customers SET (name, phone, cpf, birthday) = ($1, $2, $3, $4) WHERE id = $5;",
			[client.name, client.phone, client.cpf, client.birthday, clientParams.id]
		);

		res.status(200).send({ message: "Client info updated" });
	} catch (error) {
		console.log(error);
	}
});

app.get("/rentals", async (req, res) => {
	const customerId = req.query.customerId;
	const gameId = req.query.gameId;

	try {
		if (customerId) {
			const clientFilter = await connection.query(
				`
                SELECT r.*, 
                jsonb_build_object('id', c.id, 'name', c.name) AS customer, 
                jsonb_build_object('id', g.id, 'game', g.name, 'categoryId', g."categoryId", 'categoryName', ca.name) AS game
                FROM rentals AS r 
                JOIN customers AS c ON r."customerId" = c.id 
                JOIN games AS g ON g.id = r."gameId" 
                JOIN categories AS ca ON ca.id = g."categoryId"
                WHERE "customerId" = $1;
                `,
				[customerId]
			);
			return res.status(200).send(clientFilter.rows);
		}
		if (gameId) {
			const gameFilter = await connection.query(
				`
                SELECT r.*, 
                jsonb_build_object('id', c.id, 'name', c.name) AS customer, 
                jsonb_build_object('id', g.id, 'game', g.name, 'categoryId', g."categoryId", 'categoryName', ca.name) AS game
                FROM rentals AS r 
                JOIN customers AS c ON r."customerId" = c.id 
                JOIN games AS g ON g.id = r."gameId" 
                JOIN categories AS ca ON ca.id = g."categoryId"
                WHERE "gameId" = $1;
                `,
				[gameId]
			);
			return res.status(200).send(gameFilter.rows);
		}
		const rentalList = await connection.query(
			`
            SELECT r.*, 
            jsonb_build_object('id', c.id, 'name', c.name) AS customer, 
            jsonb_build_object('id', g.id, 'game', g.name, 'categoryId', g."categoryId", 'categoryName', ca.name) AS game
            FROM rentals AS r 
            JOIN customers AS c ON r."customerId" = c.id 
            JOIN games AS g ON g.id = r."gameId" 
            JOIN categories AS ca ON ca.id = g."categoryId";
            `
		);

		res.status(200).send(rentalList.rows);
	} catch (error) {
		console.log(error);
	}
});
app.post("/rentals", async (req, res) => {
	const rental = req.body;
	const validation = rentalSchema.validate(rental, { abortEarly: true });
	if (validation.error) return res.sendStatus(400);

	try {
		const clientExists = await connection.query(
			"SELECT * FROM customers WHERE id = $1;",
			[rental.customerId]
		);
		if (clientExists.rows.length === 0) {
			return res.status(400).send({ message: "User doesn't exist" });
		}

		const gameExists = await connection.query(
			"SELECT * FROM games WHERE id = $1",
			[rental.gameId]
		);
		if (gameExists.rows.length === 0) {
			return res.status(400).send({ message: "Game doesn't exist" });
		}

		const stockQuantity = await connection.query(
			'SELECT "stockTotal" FROM games WHERE id = $1;',
			[rental.gameId]
		);

		const gamesRented = await connection.query(
			'SELECT * FROM rentals WHERE "gameId" = $1;',
			[rental.gameId]
		);

		if (!gamesRented.rows.length < stockQuantity.rows[0].stockTotal) {
			return res.status(400).send({ message: "Out of stock" });
		}
		const chosenGame = await connection.query(
			'SELECT "pricePerDay" FROM games WHERE id = $1',
			[rental.gameId]
		);

		await connection.query(
			`INSERT INTO rentals
		    ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee")
		    VALUES
		    ($1, $2, $3, $4, $5, $6, $7)`,
			[
				rental.customerId,
				rental.gameId,
				dayjs().format("YYYY-MM-DD"),
				rental.daysRented,
				null,
				rental.daysRented * chosenGame.rows[0].pricePerDay,
				null,
			]
		);

		res.sendStatus(201);
	} catch (error) {
		console.log(error);
	}
});

export default app;
