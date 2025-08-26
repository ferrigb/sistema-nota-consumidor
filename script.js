// Estado da aplicação
let currentSale = null;
let salesHistory = [];

// URLs da API
const API_BASE = '/api';

// Elementos do DOM
const productForm = document.getElementById('product-form');
const productsList = document.getElementById('products-list');
const totalValue = document.getElementById('total-value');
const clearSaleBtn = document.getElementById('clear-sale');
const finishSaleBtn = document.getElementById('finish-sale');
const salesHistory_div = document.getElementById('sales-history');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleAddProduct(e);
        });
    }
    clearSaleBtn.addEventListener('click', handleClearSale);
    finishSaleBtn.addEventListener('click', handleFinishSale);
    modalCancel.addEventListener('click', closeModal);
    
    // Fechar modal clicando fora
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Inicializar aplicação
async function initializeApp() {
    try {
        await loadSalesHistory();
        await createNewSale(); // Sempre cria uma nova venda ao iniciar
    } catch (error) {
        console.error("Erro ao inicializar aplicação:", error);
        showError("Erro ao inicializar o sistema");
    }
}

// Forçar início limpo - sempre criar nova venda
async function forceCleanStart() {
    try {
        const response = await fetch(`${API_BASE}/vendas/limpar-atual`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao limpar venda atual');
        }
        
        const vendaLimpa = await response.json();
        currentSale = vendaLimpa;
        updateUI();
        
    } catch (error) {
        console.error('Erro ao forçar início limpo:', error);
        // Se falhar, tentar carregar venda atual normalmente
        await loadCurrentSale();
    }
}

// Carregar venda atual ou criar nova
async function loadCurrentSale() {
    try {
        const response = await fetch(`${API_BASE}/vendas/atual`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar venda atual');
        }
        
        const vendaAtual = await response.json();
        
        if (vendaAtual) {
            currentSale = vendaAtual;
        } else {
            await createNewSale();
        }
        
        updateUI();
    } catch (error) {
        console.error('Erro ao carregar venda atual:', error);
        await createNewSale();
    }
}

// Criar nova venda
async function createNewSale() {
    try {
        const response = await fetch(`${API_BASE}/vendas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao criar nova venda');
        }
        
        currentSale = await response.json();
        updateUI();
    } catch (error) {
        console.error('Erro ao criar nova venda:', error);
        showError('Erro ao criar nova venda');
    }
}

// Adicionar produto
async function handleAddProduct(e) {
    e.preventDefault();
    console.log("handleAddProduct called");
    
    const formData = new FormData(e.target);
    const nomeProduto = formData.get('nome-produto').trim();
    const quantidade = parseFloat(formData.get('quantidade'));
    const tipoQuantidade = formData.get('tipo-quantidade');
    const precoUnitario = parseFloat(formData.get('preco-unitario'));
    
    if (!nomeProduto || quantidade <= 0 || precoUnitario <= 0) {
        showError('Preencha todos os campos corretamente');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/vendas/${currentSale.id}/itens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome_produto: nomeProduto,
                quantidade: quantidade,
                tipo_quantidade: tipoQuantidade,
                preco_unitario: precoUnitario
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.erro || 'Erro ao adicionar produto');
        }
        
        currentSale = await response.json();
        updateUI();
        
        // Limpar formulário
        e.target.reset();
        document.getElementById('quantidade').value = '1';
        document.getElementById('nome-produto').focus();
        
        showSuccess('Produto adicionado com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        showError(error.message);
    }
}

// Remover produto
async function removeProduct(itemId) {
    try {
        const response = await fetch(`${API_BASE}/vendas/${currentSale.id}/itens/${itemId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.erro || 'Erro ao remover produto');
        }
        
        currentSale = await response.json();
        updateUI();
        showSuccess('Produto removido com sucesso!');
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        showError(error.message);
    }
}

// Limpar venda
function handleClearSale() {
    if (!currentSale || currentSale.itens.length === 0) {
        showError('Não há produtos para limpar');
        return;
    }
    
    showModal(
        'Limpar Venda',
        'Tem certeza que deseja remover todos os produtos da venda atual?',
        async () => {
            try {
                // Excluir venda atual e criar nova
                await fetch(`${API_BASE}/vendas/${currentSale.id}`, {
                    method: 'DELETE'
                });
                
                await createNewSale();
                showSuccess('Venda limpa com sucesso!');
            } catch (error) {
                console.error('Erro ao limpar venda:', error);
                showError('Erro ao limpar venda');
            }
        }
    );
}

// Finalizar venda
function handleFinishSale() {
    if (!currentSale || currentSale.itens.length === 0) {
        showError('Não há produtos na venda para finalizar');
        return;
    }
    
    showModal(
        'Finalizar Venda',
        `Finalizar venda no valor de R$ ${formatCurrency(currentSale.total)}?`,
        async () => {
            try {
                // Obter nome do cliente se informado
                const nomeClienteInput = document.getElementById("nome-cliente");
                const nomeCliente = nomeClienteInput ? nomeClienteInput.value.trim() : "";
                const formaPagamentoInput = document.getElementById("forma-pagamento");
                const formaPagamento = formaPagamentoInput ? formaPagamentoInput.value : "";
                
                const requestBody = {};
                if (nomeCliente) {
                    requestBody.nome_cliente = nomeCliente;
                }
                if (formaPagamento) {
                    requestBody.forma_pagamento = formaPagamento;
                }
                
                const response = await fetch(`${API_BASE}/vendas/${currentSale.id}/finalizar`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.erro || 'Erro ao finalizar venda');
                }
                
                const finalizedSale = await response.json();
                showSuccess(`Venda finalizada! Total: R$ ${formatCurrency(finalizedSale.total)}`);
                
                // Mostrar opção de gerar ticket
                showTicketModal(finalizedSale.id);
                
                // Atualizar histórico e criar nova venda
                await loadSalesHistory();
                await createNewSale();
                
                // Limpar campo de nome do cliente
                if (nomeClienteInput) {
                    nomeClienteInput.value = '';
                }
            } catch (error) {
                console.error('Erro ao finalizar venda:', error);
                showError(error.message);
            }
        }
    );
}

// Carregar histórico de vendas
async function loadSalesHistory() {
    try {
        const response = await fetch(`${API_BASE}/vendas`); // Esta rota já retorna apenas vendas finalizadas
        
        if (!response.ok) {
            throw new Error('Erro ao carregar histórico');
        }
        
        salesHistory = await response.json();
        updateSalesHistoryUI();
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showError('Erro ao carregar histórico de vendas');
    }
}

// Atualizar interface
function updateUI() {
    updateProductsList();
    updateTotal();
    updateButtons();
}

// Atualizar lista de produtos
function updateProductsList() {
    if (!currentSale || currentSale.itens.length === 0) {
        productsList.innerHTML = '<p class="empty-message">Nenhum produto adicionado ainda.</p>';
        return;
    }
    
    productsList.innerHTML = currentSale.itens.map(item => {
        const tipoDisplay = item.tipo_quantidade === 'kg' ? 'kg' : 'unid.';
        return `
            <div class="product-item">
                <div class="product-info">
                    <div class="product-name">${escapeHtml(item.nome_produto)}</div>
                    <div class="product-details">
                        Quantidade: ${item.quantidade} ${tipoDisplay} × R$ ${formatCurrency(item.preco_unitario)}
                    </div>
                </div>
                <div class="product-subtotal">R$ ${formatCurrency(item.subtotal)}</div>
                <button class="btn btn-danger" onclick="removeProduct(${item.id})">
                    Remover
                </button>
            </div>
        `;
    }).join('');
}

// Atualizar total
function updateTotal() {
    const total = currentSale ? currentSale.total : 0;
    totalValue.textContent = formatCurrency(total);
}

// Atualizar botões
function updateButtons() {
    const hasItems = currentSale && currentSale.itens.length > 0;
    clearSaleBtn.disabled = !hasItems;
    finishSaleBtn.disabled = !hasItems;
}

// Atualizar histórico de vendas
function updateSalesHistoryUI() {
    if (salesHistory.length === 0) {
        salesHistory_div.innerHTML = '<p class="empty-message">Nenhuma venda finalizada ainda.</p>';
        return;
    }
    
    // Agrupar vendas por data
    const salesByDate = salesHistory.reduce((acc, sale) => {
        const saleDate = new Date(sale.data_venda).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        if (!acc[saleDate]) {
            acc[saleDate] = [];
        }
        acc[saleDate].push(sale);
        return acc;
    }, {});

    let htmlContent = '';
    const sortedDates = Object.keys(salesByDate).sort((a, b) => new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-')));

    sortedDates.forEach(date => {
        htmlContent += `
            <div class="sales-day-group">
                <h4 class="sales-date-header">Vendas de ${date}</h4>
        `;
        salesByDate[date].forEach(sale => {
            htmlContent += `
                <div class="sale-item">
                    <div class="sale-header">
                        <div>
                            <div class="sale-id">Venda #${sale.id}</div>
                            <div class="sale-date">${formatDate(sale.data_venda)}</div>
                        </div>
                        <div class="sale-actions">
                            <div class="sale-total">R$ ${formatCurrency(sale.total)}</div>
                            <button class="btn btn-primary btn-small" onclick="generateTicket(${sale.id})">
                                📄 Ticket
                            </button>
                        </div>
                    </div>
                    <div class="sale-items">
                        ${sale.itens.map(item => {
                            const tipoDisplay = item.tipo_quantidade === 'kg' ? 'kg' : 'x';
                            return `
                                <div class="sale-item-detail">
                                    <span>${escapeHtml(item.nome_produto)} (${item.quantidade}${tipoDisplay})</span>
                                    <span>R$ ${formatCurrency(item.subtotal)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        htmlContent += '</div>';
    });
    
    salesHistory_div.innerHTML = htmlContent;
}

// Modal
function showModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'block';
    
    modalConfirm.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };
}

function closeModal() {
    modal.style.display = 'none';
    modalConfirm.onclick = null;
}

// Modal para gerar ticket
function showTicketModal(vendaId) {
    const ticketModal = document.createElement('div');
    ticketModal.className = 'modal';
    ticketModal.style.display = 'block';
    
    ticketModal.innerHTML = `
        <div class="modal-content">
            <h3>🎫 Venda Finalizada!</h3>
            <p>Deseja gerar um ticket para enviar ao cliente?</p>
            <div class="modal-actions">
                <button id="ticket-cancel" class="btn btn-secondary">Não, obrigado</button>
                <button id="ticket-generate" class="btn btn-primary">📄 Gerar Ticket</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(ticketModal);
    
    // Event listeners
    document.getElementById('ticket-cancel').onclick = () => {
        document.body.removeChild(ticketModal);
    };
    
    document.getElementById('ticket-generate').onclick = () => {
        generateTicket(vendaId);
        document.body.removeChild(ticketModal);
    };
    
    // Fechar clicando fora
    ticketModal.addEventListener('click', function(e) {
        if (e.target === ticketModal) {
            document.body.removeChild(ticketModal);
        }
    });
}

// Gerar ticket em PDF
async function generateTicket(vendaId) {
    try {
        showSuccess("Gerando ticket em PDF...");

        let venda = salesHistory.find((sale) => sale.id === vendaId);
        if (!venda) {
            const vendaResponse = await fetch(`${API_BASE}/vendas/${vendaId}`);
            if (!vendaResponse.ok) {
                throw new Error("Erro ao buscar dados da venda");
            }
            venda = await vendaResponse.json();
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        let yPosition = 15;

        // Função auxiliar para adicionar texto centralizado
        const addCenteredText = (text, y, fontSize = 10, fontStyle = 'normal', textColor = [0, 0, 0]) => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, fontStyle);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text(text, pageWidth / 2, y, { align: 'center' });
        };

        // Cabeçalho
        doc.setFillColor(46, 204, 113); // Verde
        doc.rect(0, 0, pageWidth, 20, 'F'); // Retângulo verde no topo
        addCenteredText("AGRONORTE", 10, 16, 'bold', [255, 255, 255]); // Branco
        addCenteredText("MATERIAIS DE PESCA | RAÇÕES | PÁSSAROS E AQUARISMO", 16, 8, 'normal', [255, 255, 255]);

        yPosition = 25;

        // Informações da Loja (mantidas)
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0); // Preto
        doc.text("Rua Araras 100 Centro", margin, yPosition);
        yPosition += 5;
        doc.text("Tel: 3252-6819", margin, yPosition);
        yPosition += 10;

        // Título da Venda
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`CUPOM FISCAL - VENDA #${venda.id}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 7;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Data: ${formatDate(venda.data_venda)}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;

        // Informações do Cliente (se houver)
        if (venda.nome_cliente) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`Cliente: ${venda.nome_cliente}`, margin, yPosition);
            yPosition += 7;
        }

        // Tabela de Produtos
        const tableColumn = ["Produto", "Qtd", "Preço Unit.", "Subtotal"];
        const tableRows = [];

        venda.itens.forEach(item => {
            const tipoDisplay = item.tipo_quantidade === 'kg' ? 'kg' : 'unid.';
            tableRows.push([
                item.nome_produto,
                `${item.quantidade} ${tipoDisplay}`,
                `R$ ${formatCurrency(item.preco_unitario)}`,
                `R$ ${formatCurrency(item.subtotal)}`
            ]);
        });

        doc.autoTable(tableColumn, tableRows, {
            startY: yPosition,
            headStyles: { fillColor: [46, 204, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
            altRowStyles: { fillColor: [245, 245, 245] },
            styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
            margin: { left: margin, right: margin },
            didDrawPage: function(data) {
                yPosition = data.cursor.y; // Atualiza a posição Y após a tabela
            }
        });

        yPosition = doc.autoTable.previous.finalY + 5; // Posição Y após a tabela

        // Total da Venda
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL: R$ ${formatCurrency(venda.total)}`, pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 10;

        // Forma de Pagamento
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Forma de Pagamento: ${venda.forma_pagamento || 'Não Informado'}`, margin, yPosition);
        yPosition += 10;

        // Mensagem de Agradecimento
        addCenteredText("Obrigado pela preferência! Volte sempre!", yPosition, 10, 'italic');
        yPosition += 10;

        // Rodapé
        doc.setFillColor(46, 204, 113); // Verde
        doc.rect(0, doc.internal.pageSize.height - 10, pageWidth, 10, 'F'); // Retângulo verde no rodapé
        addCenteredText("Documento não fiscal", doc.internal.pageSize.height - 5, 7, 'normal', [255, 255, 255]);

        // Salvar PDF
        doc.save(`cupom_venda_${venda.id}.pdf`);
        showSuccess("Ticket PDF gerado com sucesso!");

    } catch (error) {
        console.error('Erro ao gerar ticket:', error);
        showError(error.message || 'Erro ao gerar ticket PDF');
    }
}

// Funções utilitárias
function formatCurrency(value) {
    return parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\u0027/g, "&#039;");
}

// Mensagens de feedback
function showSuccess(message) {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
        stopOnFocus: true,
    }).showToast();
}

function showError(message) {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
        stopOnFocus: true,
    }).showToast();
}


