from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz
from src.models.user import db

def get_brasilia_time():
    """Retorna o horário atual de Brasília"""
    brasilia_tz = pytz.timezone('America/Sao_Paulo')
    utc_now = datetime.utcnow()
    utc_time = pytz.utc.localize(utc_now)
    brasilia_time = utc_time.astimezone(brasilia_tz)
    return brasilia_time.replace(tzinfo=None)  # Remove timezone info para SQLite

class Venda(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data_venda = db.Column(db.DateTime, default=get_brasilia_time)
    total = db.Column(db.Float, default=0.0)
    finalizada = db.Column(db.Boolean, default=False)
    nome_cliente = db.Column(db.String(200), nullable=True)  # Campo opcional para nome do cliente
    forma_pagamento = db.Column(db.String(50), nullable=True) # Campo para forma de pagamento
    
    # Relacionamento com itens da venda
    itens = db.relationship('ItemVenda', backref='venda', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Venda {self.id} - Total: R$ {self.total:.2f}>'
    
    def calcular_total(self):
        """Calcula o total da venda baseado nos itens"""
        self.total = sum(item.subtotal for item in self.itens)
        return self.total
    
    def to_dict(self):
        return {
            'id': self.id,
            'data_venda': self.data_venda.isoformat() if self.data_venda else None,
            'total': self.total,
            'finalizada': self.finalizada,
            'nome_cliente': self.nome_cliente,
            'forma_pagamento': self.forma_pagamento, # Incluir forma de pagamento
            'itens': [item.to_dict() for item in self.itens]
        }

class ItemVenda(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    venda_id = db.Column(db.Integer, db.ForeignKey('venda.id'), nullable=False)
    nome_produto = db.Column(db.String(200), nullable=False)
    quantidade = db.Column(db.Float, nullable=False, default=1.0)
    tipo_quantidade = db.Column(db.String(10), nullable=False, default='unidade') # 'unidade' ou 'kg'
    preco_unitario = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)    
    def __repr__(self):
        return f'<ItemVenda {self.nome_produto} - Qtd: {self.quantidade} - Subtotal: R$ {self.subtotal:.2f}>'
    
    def calcular_subtotal(self):
        """Calcula o subtotal do item (quantidade * preço unitário)"""
        self.subtotal = self.quantidade * self.preco_unitario
        return self.subtotal
    
    def to_dict(self):
        return {
            'id': self.id,
            'nome_produto': self.nome_produto,
            'quantidade': self.quantidade,
            'tipo_quantidade': self.tipo_quantidade,
            'preco_unitario': self.preco_unitario,
            'subtotal': self.subtotal
        }

