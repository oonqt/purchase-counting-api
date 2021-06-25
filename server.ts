import express from 'express';
import morgan from 'morgan';
import axios from 'axios';
import compression from 'compression';
import { PORT, API_KEY, INCLUDED_ASSET_TYPES } from './config';

const app = express();

app.use(morgan('dev'));
app.use(compression());

const canViewInventory = async (userId: number): Promise<boolean> => {
    const res = await axios(`https://inventory.roblox.com/v1/users/${userId}/can-view-inventory`);

    return res.data.canView;
}

interface UserInventoryResponse {
    Data: {
        Items: {
            Creator: {
                Id: number;
                Type: number;
            }
        }[]
        nextPageCursor: string | null;
    };
}

const getInventory = async (userId: number, assetTypeId: number, cursor: string | null): Promise<UserInventoryResponse> => {
    const res = await axios(`https://www.roblox.com/users/inventory/list-json?userId=${userId}&itemsPerPage=100&assetTypeId=${assetTypeId}${cursor ? `&cursor=${cursor}` : ''}`);

    return res.data;
}

app.get('/api/:groupId/:userId/count', async (req, res) => {
    try {
        if (req.headers.authorization !== API_KEY) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const userId = parseInt(req.params.userId);
        const groupId = parseInt(req.params.groupId);

        const canView = await canViewInventory(userId);
        if (!canView) return res.status(400).json({ success: false, message: 'Inventory must be public' });

        let count = 0;
        
        for (const type of INCLUDED_ASSET_TYPES) {
            let cursor: string | null = null;
            
            do {
                const inventory: UserInventoryResponse = await getInventory(userId, type, cursor);

                for (const item of inventory.Data.Items) {
                    if (item.Creator.Type === 2 && item.Creator.Id === groupId) count++;
                }

                cursor = inventory.Data.nextPageCursor;
            } while (cursor);
        }

        res.json({ success: true, count });
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => console.log(`Listening on: ${PORT}`));