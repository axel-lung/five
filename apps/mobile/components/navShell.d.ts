/**
 * Positionnement de la coque applicative, seule chose qui differe vraiment
 * entre le web et le natif. Metro choisit `.web.ts` ou `.native.ts` ; ce
 * fichier existe pour que `tsc` sache ce que les deux promettent.
 */
export declare const shellMainClass: string;
export declare const navBarClass: string;
export declare const useNavBarInset: () => number | undefined;
