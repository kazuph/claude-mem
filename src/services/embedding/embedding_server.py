#!/usr/bin/env python3
"""
Embedding Server for claude-mem

Serves ruri-v3-70m Japanese embeddings via HTTP.
Designed to be run as a persistent subprocess managed by claude-mem worker.

Usage:
    uvx --python 3.13 --with torch --with sentence-transformers --with sentencepiece \
        --with flask python embedding_server.py --port 37778

API:
    POST /embed
    Body: {"texts": ["text1", "text2", ...]}
    Response: {"embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]], "model": "cl-nagoya/ruri-v3-70m"}

    GET /health
    Response: {"status": "ok", "model": "cl-nagoya/ruri-v3-70m", "dimension": 384}
"""

import argparse
import json
import sys
import logging
from typing import List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [EMBED] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Default model - can be overridden via environment or args
DEFAULT_MODEL = "cl-nagoya/ruri-v3-70m"
DEFAULT_PORT = 37778

# Global model instance (loaded once)
model = None
model_name = None


def load_model(name: str, device: str = "cpu"):
    """Load the sentence-transformers model."""
    global model, model_name

    logger.info(f"Loading model: {name}")

    try:
        from sentence_transformers import SentenceTransformer
        import torch

        # Use specified device (default: cpu to save memory)
        # MPS on Apple Silicon uses ~4GB+ due to Metal memory pool overhead
        # CPU mode uses ~300-500MB which is much more reasonable
        if device == "auto":
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"

        logger.info(f"Using device: {device}")

        model = SentenceTransformer(name, device=device)
        model_name = name

        # Get embedding dimension
        dim = model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded successfully. Embedding dimension: {dim}")

        return True
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return False


def compute_embeddings(texts: List[str]) -> List[List[float]]:
    """Compute embeddings for a list of texts."""
    global model

    if model is None:
        raise RuntimeError("Model not loaded")

    # Compute embeddings
    embeddings = model.encode(texts, convert_to_numpy=True)

    # Convert to list of lists (JSON serializable)
    return embeddings.tolist()


def create_app():
    """Create Flask application."""
    from flask import Flask, request, jsonify

    app = Flask(__name__)

    @app.route('/health', methods=['GET'])
    def health():
        """Health check endpoint."""
        if model is None:
            return jsonify({"status": "error", "message": "Model not loaded"}), 503

        dim = model.get_sentence_embedding_dimension()
        return jsonify({
            "status": "ok",
            "model": model_name,
            "dimension": dim
        })

    @app.route('/embed', methods=['POST'])
    def embed():
        """Compute embeddings for texts."""
        try:
            data = request.get_json()

            if not data or 'texts' not in data:
                return jsonify({"error": "Missing 'texts' field"}), 400

            texts = data['texts']

            if not isinstance(texts, list):
                return jsonify({"error": "'texts' must be a list"}), 400

            if len(texts) == 0:
                return jsonify({"embeddings": [], "model": model_name})

            # Compute embeddings
            embeddings = compute_embeddings(texts)

            return jsonify({
                "embeddings": embeddings,
                "model": model_name
            })

        except Exception as e:
            logger.error(f"Embedding error: {e}")
            return jsonify({"error": str(e)}), 500

    return app


def main():
    parser = argparse.ArgumentParser(description='Embedding server for claude-mem')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f'Port to listen on (default: {DEFAULT_PORT})')
    parser.add_argument('--model', type=str, default=DEFAULT_MODEL, help=f'Model to use (default: {DEFAULT_MODEL})')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind to (default: 127.0.0.1)')
    parser.add_argument('--device', type=str, default='cpu', choices=['cpu', 'cuda', 'mps', 'auto'],
                        help='Device to use (default: cpu). Use "auto" for GPU if available.')

    args = parser.parse_args()

    # Load model
    if not load_model(args.model, args.device):
        logger.error("Failed to load model. Exiting.")
        sys.exit(1)

    # Create and run app
    app = create_app()

    logger.info(f"Starting embedding server on {args.host}:{args.port}")

    # Use werkzeug's run_simple for production (no reloader, threaded)
    from werkzeug.serving import run_simple
    run_simple(args.host, args.port, app, use_reloader=False, threaded=True)


if __name__ == '__main__':
    main()
