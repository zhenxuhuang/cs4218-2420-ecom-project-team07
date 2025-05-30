import categoryModel from "../models/categoryModel.js";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";

import braintree from "braintree";
import dotenv from "dotenv";
import fs from "fs";
import StatusCodes from "http-status-codes";
import slugify from "slugify";

dotenv.config();

//payment gateway
var gateway = new braintree.BraintreeGateway({
	environment: braintree.Environment.Sandbox,
	merchantId: process.env.BRAINTREE_MERCHANT_ID,
	publicKey: process.env.BRAINTREE_PUBLIC_KEY,
	privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

export const createProductController = async (req, res) => {
	try {
		const { name, description, price, category, quantity, shipping } =
			req.fields;
		const { photo } = req.files;
		// Validation
		switch (true) {
			case !name:
				return res.status(500).send({ error: "Name is Required" });
			case !description:
				return res.status(500).send({ error: "Description is Required" });
			case !price:
				return res.status(500).send({ error: "Price is Required" });
			case !category:
				return res.status(500).send({ error: "Category is Required" });
			case !quantity:
				return res.status(500).send({ error: "Quantity is Required" });
			case photo && photo.size > 1000000:
				return res
					.status(500)
					.send({ error: "Photo is Required and should be less then 1mb" });
		}

		const products = new productModel({ ...req.fields, slug: slugify(name) });
		if (photo) {
			products.photo.data = fs.readFileSync(photo.path);
			products.photo.contentType = photo.type;
		}
		await products.save();
		res.status(201).send({
			success: true,
			message: "Product Created Successfully",
			products,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send({
			success: false,
			error,
			message: "Error in crearing product",
		});
	}
};

/**
 * @returns all products, excluding their photos
 */
export const getProductController = async (req, res) => {
	try {
		let products = await productModel
			.find({})
			.select("-photo")
			.populate("category")
			.sort({ createdAt: -1 });
		res.status(StatusCodes.OK).send({
			products,
		});
	} catch (error) {
		console.error(error);
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
			message: "Error encountered while getting all products.",
		});
	}
};

/**
 * Request must include `params`:
 * - `slug`: the product's slug in kebab case, e.g. "my-product"
 * @returns the specified product, excluding its photo
 */
export const getSingleProductController = async (req, res) => {
	try {
		let product = await productModel
			.findOne({ slug: req.params.slug })
			.select("-photo")
			.populate("category");
			res.status(StatusCodes.OK).send({
				product,
			});
	} catch (error) {
		console.error(error);
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
			message: "Error encountered while getting single product.",
		});
	}
};

/**
 * Request must include `params`:
 * - `pid`: the product's ID
 * @returns the specified product's photo
 */
export const productPhotoController = async (req, res) => {
	try {
		let product = await productModel
			.findById(req.params.pid)
			.select("photo");
		if (!product) {
			res.status(StatusCodes.NOT_FOUND).send();
		}

		let { photo } = product;
		if (!photo.contentType || !photo.data) {
			res.status(StatusCodes.NO_CONTENT).send();
		}

		res.set("Content-Type", photo.contentType);
		res.status(StatusCodes.OK).send(photo.data);
	} catch (error) {
		console.error(error);
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
			message: "Error encountered while getting product photo.",
		});
	}
};

// Delete product
export const deleteProductController = async (req, res) => {
	try {
		await productModel.findByIdAndDelete(req.params.pid).select("-photo");
		res.status(200).send({
			success: true,
			message: "Product Deleted successfully",
		});
	} catch (error) {
		console.log(error);
		res.status(500).send({
			success: false,
			message: "Error while deleting product",
			error,
		});
	}
};

// Update product
export const updateProductController = async (req, res) => {
	try {
		const { name, description, price, category, quantity, shipping } =
			req.fields;
		const { photo } = req.files;
		// Validation
		switch (true) {
			case !name:
				return res.status(500).send({ error: "Name is Required" });
			case !description:
				return res.status(500).send({ error: "Description is Required" });
			case !price:
				return res.status(500).send({ error: "Price is Required" });
			case !category:
				return res.status(500).send({ error: "Category is Required" });
			case !quantity:
				return res.status(500).send({ error: "Quantity is Required" });
			case photo && photo.size > 1000000:
				return res
					.status(500)
					.send({ error: "photo is Required and should be less then 1mb" });
		}

		const products = await productModel.findByIdAndUpdate(
			req.params.pid,
			{ ...req.fields, slug: slugify(name) },
			{ new: true }
		);
		if (photo) {
			products.photo.data = fs.readFileSync(photo.path);
			products.photo.contentType = photo.type;
		}
		await products.save();
		res.status(201).send({
			success: true,
			message: "Product Updated Successfully",
			products,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send({
			success: false,
			error,
			message: "Error in Updte product",
		});
	}
};

// filters
export const productFiltersController = async (req, res) => {
	try {
		const { checked, radio } = req.body;
		let args = {};
		if (checked.length > 0) args.category = checked;
		if (radio.length) args.price = { $gte: radio[0], $lte: radio[1] };
		const products = await productModel.find(args);
		res.status(200).send({
			success: true,
			products,
		});
	} catch (error) {
		console.log(error);
		res.status(400).send({
			success: false,
			message: "Error WHile Filtering Products",
			error,
		});
	}
};

/**
 * @returns the count of all products
 */
export const productCountController = async (req, res) => {
	try {
		let count = await productModel
			.find({})
			.estimatedDocumentCount();
		res.status(StatusCodes.OK).send({
			total: count,
		});
	} catch (error) {
		console.error(error);
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
			message: "Error encountered while counting all products.",
		});
	}
};

// product list base on page
export const productListController = async (req, res) => {
	try {
		const perPage = 6;
		const page = req.params.page ? req.params.page : 1;
		const products = await productModel
			.find({})
			.select("-photo")
			.skip((page - 1) * perPage)
			.limit(perPage)
			.sort({ createdAt: -1 });
		res.status(200).send({
			success: true,
			products,
		});
	} catch (error) {
		console.log(error);
		res.status(400).send({
			success: false,
			message: "error in per page ctrl",
			error,
		});
	}
};

// search product
export const searchProductController = async (req, res) => {
	try {
		const { keyword } = req.params;
		const results = await productModel
			.find({
				$or: [
					{ name: { $regex: keyword, $options: "i" } },
					{ description: { $regex: keyword, $options: "i" } },
				],
			})
			.select("-photo");
		res.json(results);
	} catch (error) {
		console.log(error);
		res.status(400).send({
			success: false,
			message: "Error In Search Product API",
			error,
		});
	}
};

// similar products
export const relatedProductController = async (req, res) => {
	try {
		const { pid, cid } = req.params;
		const products = await productModel
			.find({
				category: cid,
				_id: { $ne: pid },
			})
			.select("-photo")
			.limit(3)
			.populate("category");
		res.status(200).send({
			success: true,
			products,
		});
	} catch (error) {
		console.log(error);
		res.status(400).send({
			success: false,
			message: "error while geting related product",
			error,
		});
	}
};

// get product by category
export const productCategoryController = async (req, res) => {
	try {
		const category = await categoryModel.findOne({ slug: req.params.slug });
		const products = await productModel.find({ category }).populate("category");
		res.status(200).send({
			success: true,
			category,
			products,
		});
	} catch (error) {
		console.log(error);
		res.status(400).send({
			success: false,
			error,
			message: "Error While Getting products",
		});
	}
};

//payment gateway api
//token
export const braintreeTokenController = async (req, res) => {
	try {
		gateway.clientToken.generate({}, function (err, response) {
			if (err) {
				res.status(500).send(err);
			} else {
				res.send(response);
			}
		});
	} catch (error) {
		console.log(error);
	}
};

//payment
export const brainTreePaymentController = async (req, res) => {
	try {
		const { nonce, cart } = req.body;
		let total = 0;
		cart.map((i) => {
			total += i.price;
		});
		let newTransaction = gateway.transaction.sale(
			{
				amount: total,
				paymentMethodNonce: nonce,
				options: {
					submitForSettlement: true,
				},
			},
			function (error, result) {
				if (result) {
					const order = new orderModel({
						products: cart,
						payment: result,
						buyer: req.user._id,
					}).save();
					res.json({ ok: true });
				} else {
					res.status(500).send(error);
				}
			}
		);
	} catch (error) {
		console.log(error);
	}
};
