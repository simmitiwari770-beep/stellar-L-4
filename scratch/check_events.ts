import { rpc as SorobanRpc } from '@stellar/stellar-sdk';

async function checkEvents() {
    const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
    const ledger = await server.getLatestLedger();
    console.log('Latest ledger:', ledger.sequence);

    const contractIds = [
        'CDERE3Z5WUQ6XSQYQ5QHKFHQ3ZOU7VEYAMXYR34U75TRMGXLDO42QE6X',
        'CB2QIUP5GAMFN5AUSGO32YOS63F3RDLENWOR3WGAFG2SUSC5BCUGUXFC',
        'CDSHNF2Y3YFNG2TEMFXHOVV26GVNF7AFFUJWHQJPHEMVNS6WXOJ754KL'
    ];

    const startLedger = Math.max(1, ledger.sequence - 10000);
    console.log('Fetching from:', startLedger);

    try {
        const response = await server.getEvents({
            startLedger,
            filters: contractIds.map(id => ({
                type: 'contract',
                contractIds: [id]
            })),
            limit: 10
        });

        console.log('Found events:', response.events.length);
        response.events.forEach(e => {
            console.log(`- Ledger ${e.ledger}, Contract ${e.contractId}, ID ${e.id}`);
        });
    } catch (err) {
        console.error('Error fetching events:', err);
    }
}

checkEvents();
