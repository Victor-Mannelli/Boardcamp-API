import express, { json } from "express";
import cors from "cors";
import connection from "./database.js";

const app = express();
app.use(cors());
app.use(json());

app.get("/categories", async (_req, res) => {
	try {
		const categories = await connection.query("SELECT * FROM categories");
		res.status(201).send(categories.rows);
	} catch (error) {
		console.log(error);
	}
});
app.post("/categories", async (req, res) => {
	const category = req.body.name;

	if (!category) {
		return res.status(400).send({ message: "There must be a category to add" });
	}
	try {
		const existingCategory = await connection.query(
			`SELECT * FROM categories WHERE name = '${category}';`
		);

		if (existingCategory.rows.length > 0) {
			return res.status(409).send({ message: "The category already exists" });
		}

		await connection.query(
			`INSERT INTO categories (name) VALUES ('${category}');`
		);
		res.sendStatus(201);
	} catch (error) {
		console.log(error);
	}
});

export default app;
