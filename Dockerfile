FROM nginx:alpine

COPY index.html   /usr/share/nginx/html/index.html
COPY menu.html    /usr/share/nginx/html/menu.html
COPY ordina.html  /usr/share/nginx/html/ordina.html
COPY css/    /usr/share/nginx/html/css/
COPY js/     /usr/share/nginx/html/js/
COPY public/ /usr/share/nginx/html/public/
COPY menu/   /usr/share/nginx/html/menu/

EXPOSE 80
