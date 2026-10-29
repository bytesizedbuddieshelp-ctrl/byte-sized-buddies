import { useEffect, useState } from 'preact/hooks';
import { HomeBlocks } from './HomeBlocks';
import { isConfigured } from '../../lib/config';
import { defaultBlocks, loadHomePage, type Block } from '../../lib/homePage';

// The landing page. It is built into the site with the original words, so it shows at once and works
// even if the database is slow or down. Then it looks for a page the owner saved in /admin/site and, if
// there is one, swaps it in.
export default function HomePage() {
  const [blocks, setBlocks] = useState<Block[]>(defaultBlocks);

  useEffect(() => {
    if (!isConfigured) return;
    loadHomePage()
      .then((saved) => saved && setBlocks(saved))
      .catch(() => undefined);
  }, []);

  return <HomeBlocks blocks={blocks} />;
}
