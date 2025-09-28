-- Script: schema.sql
-- Create database (locally). In Render, create the DB instance named 'ordenes_db' and run only table scripts.
-- CREATE DATABASE ordenes_db;

-- Drop tables if exist (for local resets)
DROP TABLE IF EXISTS public.ordenes;
DROP TABLE IF EXISTS public.clientes;

-- clientes
CREATE TABLE public.clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) UNIQUE NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  telefono VARCHAR(30) NOT NULL
);

-- ordenes
CREATE TABLE public.ordenes (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  platillo_nombre VARCHAR(140) NOT NULL,
  notas TEXT,
  estado VARCHAR(20) DEFAULT 'pending',
  creado TIMESTAMP DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX idx_ordenes_cliente ON public.ordenes(cliente_id);
CREATE INDEX idx_ordenes_estado ON public.ordenes(estado);
